import axios from 'axios';
import Peer, { MediaConnection } from 'peerjs';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface VoicePlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_muted: boolean;
    is_video_enabled?: boolean;
}

interface ConnectionState {
    iceConnectionState: string;
    connectionState: string;
}

interface CallData {
    playerId: number;
    call: MediaConnection;
    createdAt: number;
    audioElement?: HTMLAudioElement;
    videoElement?: HTMLVideoElement;
}

const STALE_CALL_MS = 15000;
// Treat only 'failed' and 'closed' as terminal. 'disconnected' is often transient
// (mobile/wifi blips) and the browser self-heals within 1-3s — tearing down on
// every blip would cause audible gaps where none existed before.
const UNHEALTHY_STATES = new Set(['failed', 'closed']);

export interface VoiceChatContextValue {
    // Connection state
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;

    // Current user controls
    isMuted: boolean;
    isVideoEnabled: boolean;
    hasMicrophoneAccess: boolean;
    hasCameraAccess: boolean;
    toggleMute: () => Promise<void>;
    toggleVideo: () => Promise<void>;

    // All players' state
    players: VoicePlayer[];
    speakingPlayers: Set<number>;
    remoteVideos: Map<number, MediaStream>;
    // True while the remote's video track is muted (i.e. they're sending the
    // disabled placeholder track, not real camera frames). Receivers gate the
    // <video> element's visibility on this so the placeholder never appears
    // as a black tile.
    remoteVideoMuted: Map<number, boolean>;
    connectionStates: Map<number, ConnectionState>;

    // Local video stream (for current user's preview)
    localVideoStream: MediaStream | null;

    // Connection management
    connect: () => Promise<void>;
    disconnect: () => void;
}

const VoiceChatContext = createContext<VoiceChatContextValue | null>(null);

interface VoiceChatProviderProps {
    children: ReactNode;
    gameSlug: string;
    roomCode: string;
    currentPlayerId: number;
}

export function VoiceChatProvider({ children, gameSlug, roomCode, currentPlayerId }: VoiceChatProviderProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [players, setPlayers] = useState<VoicePlayer[]>([]);
    const [speakingPlayers, setSpeakingPlayers] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [connectionStates, setConnectionStates] = useState<Map<number, ConnectionState>>(new Map());
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasMicrophoneAccess, setHasMicrophoneAccess] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [hasCameraAccess, setHasCameraAccess] = useState(false);
    const [remoteVideos, setRemoteVideos] = useState<Map<number, MediaStream>>(new Map());
    const [remoteVideoMuted, setRemoteVideoMuted] = useState<Map<number, boolean>>(new Map());
    const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);

    const peerRef = useRef<Peer | null>(null);
    const localVideoStreamRef = useRef<MediaStream | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callsRef = useRef<Map<number, CallData>>(new Map());
    const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const peerPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoConnectAttempted = useRef(false);
    const silentAudioContextRef = useRef<AudioContext | null>(null);
    // The placeholder canvas-derived video track that's spliced into every
    // peer connection so the SDP always has an m=video line. We swap real
    // camera frames in/out of the existing video sender via replaceTrack, so
    // viewers (no camera) can still receive video from streamers.
    const silentVideoTrackRef = useRef<MediaStreamTrack | null>(null);
    // Per-player analyser bookkeeping. setupAudioLevelDetection is called both
    // from incoming-stream handling and from toggleMute; without dedup we'd
    // race multiple rAF loops + AudioContexts for the same playerId.
    const analysersRef = useRef<Map<number, { ctx: AudioContext; rafId: number | null }>>(new Map());

    // Generate unique peer ID for this player in this room
    const getPeerId = useCallback((playerId: number) => `${roomCode}-player-${playerId}`, [roomCode]);

    // Polite-peer rule: only the higher player id initiates calls. The lower id
    // peer waits for incoming calls. Guarantees exactly one MediaConnection per
    // pair and eliminates glare.
    const shouldInitiateCallTo = useCallback(
        (otherPlayerId: number) => currentPlayerId > otherPlayerId,
        [currentPlayerId],
    );

    // Build a placeholder MediaStream with both audio and video tracks, both
    // disabled. We hand this to PeerJS so every offer/answer SDP has both
    // m=audio and m=video lines — even for users who never grant any
    // permissions. Real audio/video tracks are spliced in later via
    // sender.replaceTrack(), so the SDP shape never changes after negotiation.
    const createSilentStream = (): MediaStream => {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        silentAudioContextRef.current = audioContext;

        const oscillator = audioContext.createOscillator();
        const dst = audioContext.createMediaStreamDestination();
        oscillator.connect(dst);
        oscillator.start();

        // 2x2 black canvas, captured at 1 fps. With track.enabled=false the
        // encoder emits muted RTP only — no real frames go out. The 1 fps is
        // there so the track is unambiguously "live" for receivers; 0 fps
        // requires explicit requestFrame() and some browsers consider it dead.
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const c2d = canvas.getContext('2d');
        if (c2d) {
            c2d.fillStyle = '#000';
            c2d.fillRect(0, 0, 2, 2);
        }
        const placeholderVideoStream = (canvas as HTMLCanvasElement).captureStream(1);
        const placeholderVideoTrack = placeholderVideoStream.getVideoTracks()[0];
        silentVideoTrackRef.current = placeholderVideoTrack ?? null;

        const stream = new MediaStream([
            ...dst.stream.getAudioTracks(),
            ...placeholderVideoStream.getVideoTracks(),
        ]);
        stream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
        stream.getVideoTracks().forEach(track => {
            track.enabled = false;
        });
        return stream;
    };

    // Build the MediaStream we hand to peer.call/call.answer. Always includes
    // exactly one audio track (real mic if unlocked, placeholder otherwise) and
    // exactly one video track (real camera if on, placeholder otherwise) so the
    // SDP shape is consistent and senders are stable.
    const buildSendStream = useCallback((): MediaStream | null => {
        if (!localStreamRef.current) {
            return null;
        }
        const tracks: MediaStreamTrack[] = [];
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            tracks.push(audioTrack);
        }
        const realVideoTrack = localVideoStreamRef.current?.getVideoTracks()[0] ?? null;
        const placeholderVideoTrack = silentVideoTrackRef.current;
        const videoTrack = realVideoTrack ?? placeholderVideoTrack;
        if (videoTrack) {
            tracks.push(videoTrack);
        }
        return new MediaStream(tracks);
    }, []);

    // Swap the video sender's track on every active call. Used by toggleVideo
    // to splice real camera frames in/out without renegotiating the connection
    // — the video transceiver was created at peer.call() time using the
    // placeholder, so the m=video line stays put forever.
    const swapVideoTrack = useCallback((track: MediaStreamTrack | null) => {
        callsRef.current.forEach(({ call, playerId }) => {
            // Every connection carries a video sender from the placeholder
            // negotiation, so look strictly for kind === 'video'.
            const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
            if (!sender) {
                console.warn(`[Voice] No video sender for player ${playerId}; cannot swap`);
                return;
            }
            sender.replaceTrack(track)
                .then(() => console.log(`[Voice] Swapped video track for player ${playerId} -> ${track?.id ?? 'null'}`))
                .catch(err => console.error(`[Voice] Failed to swap video track for player ${playerId}:`, err));
        });
    }, []);

    // Fetch voice status of all players
    const fetchVoiceStatus = useCallback(async () => {
        try {
            const response = await axios.get(route('rooms.voice.status', [gameSlug, roomCode]));
            setPlayers(response.data.players);
        } catch {
            // Silently fail
        }
    }, [gameSlug, roomCode]);

    // Setup audio level detection for speaking indicator.
    //
    // Tuned to be voice-specific rather than "any sound":
    //   - higher FFT resolution (1024) so we can isolate the voice band
    //   - analyse only ~85Hz–3400Hz where speech energy lives, ignoring
    //     bass rumble, hiss, and fan/HVAC noise
    //   - hysteresis: start threshold (38) higher than stop threshold (24),
    //     so quiet syllables don't toggle the indicator on and off
    //   - hold time (280ms): stay "speaking" briefly after voice drops, so
    //     the indicator doesn't strobe between syllables
    //   - throttled to ~20Hz updates and only re-renders when the boolean
    //     for this player actually flips
    const teardownAnalyser = useCallback((playerId: number) => {
        const existing = analysersRef.current.get(playerId);
        if (!existing) {
            return;
        }
        analysersRef.current.delete(playerId);
        if (existing.rafId !== null) {
            cancelAnimationFrame(existing.rafId);
        }
        existing.ctx.close().catch(() => undefined);
    }, []);

    const setupAudioLevelDetection = useCallback((stream: MediaStream, playerId: number) => {
        // Stop any prior analyser for this player before installing a new one.
        teardownAnalyser(playerId);

        try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);

            const binHz = audioContext.sampleRate / analyser.fftSize;
            const startBin = Math.max(1, Math.floor(85 / binHz));
            const endBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(3400 / binHz));
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const SPEAK_START = 38;
            const SPEAK_STOP = 24;
            const HOLD_MS = 280;
            const TICK_MS = 50;

            const entry: { ctx: AudioContext; rafId: number | null } = { ctx: audioContext, rafId: null };
            analysersRef.current.set(playerId, entry);

            let speakingState = false;
            let stopHoldUntil = 0;
            let lastTickAt = 0;

            const tick = () => {
                // If this analyser was retired (replaced or torn down), stop ticking.
                if (analysersRef.current.get(playerId) !== entry) {
                    return;
                }
                if (!callsRef.current.has(playerId) && playerId !== currentPlayerId) {
                    teardownAnalyser(playerId);
                    return;
                }

                const now = performance.now();
                if (now - lastTickAt < TICK_MS) {
                    entry.rafId = requestAnimationFrame(tick);
                    return;
                }
                lastTickAt = now;

                analyser.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = startBin; i <= endBin; i++) {
                    sum += dataArray[i];
                }
                const voiceLevel = sum / (endBin - startBin + 1);

                let nextSpeaking = speakingState;
                if (voiceLevel >= SPEAK_START) {
                    nextSpeaking = true;
                    stopHoldUntil = now + HOLD_MS;
                } else if (voiceLevel < SPEAK_STOP && now >= stopHoldUntil) {
                    nextSpeaking = false;
                }

                if (nextSpeaking !== speakingState) {
                    speakingState = nextSpeaking;
                    setSpeakingPlayers(prev => {
                        if (prev.has(playerId) === nextSpeaking) {
                            return prev;
                        }
                        const next = new Set(prev);
                        if (nextSpeaking) {
                            next.add(playerId);
                        } else {
                            next.delete(playerId);
                        }
                        return next;
                    });
                }

                entry.rafId = requestAnimationFrame(tick);
            };
            entry.rafId = requestAnimationFrame(tick);
        } catch (err) {
            console.error('Failed to setup audio level detection:', err);
        }
    }, [currentPlayerId, teardownAnalyser]);

    // Handle incoming stream
    const handleStream = useCallback((stream: MediaStream, playerId: number) => {
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        console.log(`[Voice] Received stream from player ${playerId}`, {
            audioTracks: audioTracks.length,
            videoTracks: videoTracks.length,
            audioEnabled: audioTracks[0]?.enabled,
            videoEnabled: videoTracks[0]?.enabled,
        });

        // Handle audio tracks
        if (audioTracks.length > 0) {
            // Remove existing audio element
            const existingAudio = document.getElementById(`audio-${playerId}`);
            if (existingAudio) {
                existingAudio.remove();
            }

            const audioElement = document.createElement('audio');
            audioElement.id = `audio-${playerId}`;
            audioElement.srcObject = stream;
            audioElement.autoplay = true;
            audioElement.setAttribute('playsinline', 'true');
            audioElement.volume = 1;
            audioElement.muted = false;
            document.body.appendChild(audioElement);

            console.log(`[Voice] Audio element created for player ${playerId}:`, {
                volume: audioElement.volume,
                muted: audioElement.muted,
                paused: audioElement.paused,
                tracks: stream.getAudioTracks().length,
            });

            // Play audio with error handling
            audioElement.play()
                .then(() => {
                    console.log(`[Voice] Audio playing successfully for player ${playerId}`);
                })
                .catch((err) => {
                    console.error(`[Voice] Audio autoplay failed for player ${playerId}:`, err);
                    console.log('[Voice] User interaction required to play audio');
                    // Retry on user interaction
                    const clickHandler = () => {
                        audioElement.play()
                            .then(() => console.log(`[Voice] Audio resumed after user interaction`))
                            .catch(e => console.error('[Voice] Still failed:', e));
                        document.removeEventListener('click', clickHandler);
                    };
                    document.addEventListener('click', clickHandler);
                });

            // Update call data
            const callData = callsRef.current.get(playerId);
            if (callData) {
                callData.audioElement = audioElement;
            }

            // Setup speaking indicator
            setupAudioLevelDetection(stream, playerId);
        }

        // Handle video tracks
        if (videoTracks.length > 0) {
            console.log(`[Voice] Received video stream from player ${playerId}`);
            setRemoteVideos(prev => {
                const next = new Map(prev);
                next.set(playerId, stream);
                return next;
            });
        }
    }, [setupAudioLevelDetection]);

    // Clean up call
    const cleanupCall = useCallback((playerId: number) => {
        const callData = callsRef.current.get(playerId);
        if (callData) {
            callData.call.close();
            if (callData.audioElement) {
                callData.audioElement.srcObject = null;
                callData.audioElement.remove();
            }
            if (callData.videoElement) {
                callData.videoElement.srcObject = null;
                callData.videoElement.remove();
            }
            callsRef.current.delete(playerId);
        }
        const existingAudio = document.getElementById(`audio-${playerId}`);
        if (existingAudio) {
            existingAudio.remove();
        }

        teardownAnalyser(playerId);

        // Remove remote video + muted state
        setRemoteVideos(prev => {
            const next = new Map(prev);
            next.delete(playerId);
            return next;
        });
        setRemoteVideoMuted(prev => {
            const next = new Map(prev);
            next.delete(playerId);
            return next;
        });
    }, [teardownAnalyser]);

    // Call another player. Only called from the polite-peer initiator side;
    // glare cannot happen. Existing-call check and retry decisions are made
    // by the retry poll, not here.
    const callPlayer = useCallback((playerId: number) => {
        if (!peerRef.current || !localStreamRef.current) return;
        if (!shouldInitiateCallTo(playerId)) return;

        const peerId = getPeerId(playerId);
        const streamToSend = buildSendStream();
        if (!streamToSend) return;

        console.log(`[Voice] Calling player ${playerId} (${peerId}) with stream:`, streamToSend);

        try {
            const call = peerRef.current.call(peerId, streamToSend);

            // Monitor ICE connection state for actual P2P connection
            if (call.peerConnection) {
                const updateConnectionState = () => {
                    const iceState = call.peerConnection.iceConnectionState;
                    const connectionState = call.peerConnection.connectionState;
                    console.log(`[Voice] ICE connection to player ${playerId}: ${iceState}, connection: ${connectionState}`);

                    setConnectionStates(prev => {
                        const next = new Map(prev);
                        next.set(playerId, { iceConnectionState: iceState, connectionState: connectionState || 'unknown' });
                        return next;
                    });
                    // Retry decisions live in the peer-polling loop; no inline retry here.
                };

                call.peerConnection.addEventListener('iceconnectionstatechange', updateConnectionState);
                call.peerConnection.addEventListener('connectionstatechange', updateConnectionState);
                updateConnectionState(); // Initial state

                // Listen for dynamically added tracks (e.g., when remote user enables video after connection)
                call.peerConnection.addEventListener('track', (event) => {
                    console.log(`[Voice] Track event from player ${playerId}:`, {
                        kind: event.track.kind,
                        muted: event.track.muted,
                        enabled: event.track.enabled,
                        readyState: event.track.readyState,
                    });

                    if (event.track.kind === 'video') {
                        const track = event.track;
                        const stream = event.streams[0];

                        // Always attach the stream — track.muted may be true
                        // initially (the remote starts on the placeholder
                        // track) but it'll unmute when they enable camera.
                        if (stream) {
                            console.log(`[Voice] Adding video from player ${playerId}`);
                            setRemoteVideos(prev => {
                                const next = new Map(prev);
                                next.set(playerId, stream);
                                return next;
                            });
                        }
                        // Seed muted state from the current track. With the
                        // placeholder approach this is true at connection time
                        // for any peer whose camera is off, so we must not
                        // assume false.
                        setRemoteVideoMuted(prev => new Map(prev).set(playerId, track.muted));

                        track.addEventListener('mute', () => {
                            console.log(`[Voice] Video track muted from player ${playerId}`);
                            setRemoteVideoMuted(prev => new Map(prev).set(playerId, true));
                        });

                        track.addEventListener('unmute', () => {
                            console.log(`[Voice] Video track unmuted from player ${playerId}`);
                            setRemoteVideoMuted(prev => new Map(prev).set(playerId, false));
                            if (stream) {
                                setRemoteVideos(prev => {
                                    const next = new Map(prev);
                                    next.set(playerId, stream);
                                    return next;
                                });
                            }
                        });

                        track.addEventListener('ended', () => {
                            console.log(`[Voice] Video track ended from player ${playerId}`);
                            setRemoteVideos(prev => {
                                const next = new Map(prev);
                                next.delete(playerId);
                                return next;
                            });
                            setRemoteVideoMuted(prev => {
                                const next = new Map(prev);
                                next.delete(playerId);
                                return next;
                            });
                        });
                    }
                });
            }

            call.on('stream', (remoteStream) => {
                console.log(`[Voice] Received stream from player ${playerId}`, remoteStream);
                handleStream(remoteStream, playerId);
            });

            call.on('close', () => {
                console.log(`[Voice] Call closed with player ${playerId}`);
                setConnectionStates(prev => {
                    const next = new Map(prev);
                    next.delete(playerId);
                    return next;
                });
                cleanupCall(playerId);
            });

            call.on('error', (err) => {
                console.error(`[Voice] Call error with player ${playerId}:`, err);
                cleanupCall(playerId);
                setConnectionStates(prev => {
                    const next = new Map(prev);
                    next.delete(playerId);
                    return next;
                });
            });

            callsRef.current.set(playerId, { playerId, call, createdAt: Date.now() });
        } catch (err) {
            console.error(`[Voice] Failed to call player ${playerId}:`, err);
        }
    }, [getPeerId, shouldInitiateCallTo, handleStream, cleanupCall, buildSendStream]);

    // Connect to voice chat
    const connect = useCallback(async () => {
        try {
            setError(null);

            // Create a silent stream (no microphone permission required)
            // This allows users to hear others without granting mic access
            const stream = createSilentStream();
            console.log('[Voice] Created silent stream (no mic permission needed)');
            localStreamRef.current = stream;
            setHasMicrophoneAccess(false);

            // Create peer with unique ID
            const myPeerId = getPeerId(currentPlayerId);
            console.log(`Creating peer with ID: ${myPeerId}`);

            const peer = new Peer(myPeerId, {
                debug: 2,
                config: {
                    iceServers: [
                        // STUN servers for NAT discovery
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        // TURN servers for relay when direct P2P fails (required for production)
                        // Using Metered.ca free TURN servers
                        {
                            urls: 'turn:a.relay.metered.ca:80',
                            username: '1cd7232ede5bd394292ecabe',
                            credential: 'R8iCubl+s9JngWxa',
                        },
                        {
                            urls: 'turn:a.relay.metered.ca:80?transport=tcp',
                            username: '1cd7232ede5bd394292ecabe',
                            credential: 'R8iCubl+s9JngWxa',
                        },
                        {
                            urls: 'turn:a.relay.metered.ca:443',
                            username: '1cd7232ede5bd394292ecabe',
                            credential: 'R8iCubl+s9JngWxa',
                        },
                        {
                            urls: 'turn:a.relay.metered.ca:443?transport=tcp',
                            username: '1cd7232ede5bd394292ecabe',
                            credential: 'R8iCubl+s9JngWxa',
                        },
                    ],
                },
            });

            peerRef.current = peer;

            peer.on('open', async (id) => {
                console.log(`[Voice] Peer opened, ID: ${id}`);
                setIsConnected(true);
                setIsMuted(true); // Start muted
                setIsConnecting(false);

                // Start polling for player status
                statusPollingRef.current = setInterval(fetchVoiceStatus, 3000);

                // Fetch current players
                const response = await axios.get(route('rooms.voice.status', [gameSlug, roomCode]));
                const currentPlayers = response.data.players as VoicePlayer[];
                setPlayers(currentPlayers);

                // Call other players we are supposed to initiate to. Polite-peer
                // rule means each pair has exactly one initiator, so no glare.
                for (const player of currentPlayers) {
                    if (player.id !== currentPlayerId && shouldInitiateCallTo(player.id)) {
                        // Small delay to let peer IDs register on PeerJS cloud
                        setTimeout(() => callPlayer(player.id), 500);
                    }
                }

                // Poll every 5s for (a) newly joined players we should call and
                // (b) existing calls that have genuinely failed. Only the
                // initiator side re-calls — the answerer side just lets
                // cleanupCall propagate the failure to the initiator.
                peerPollingRef.current = setInterval(async () => {
                    try {
                        const res = await axios.get(route('rooms.voice.status', [gameSlug, roomCode]));
                        const players = res.data.players as VoicePlayer[];
                        const now = Date.now();

                        for (const player of players) {
                            if (player.id === currentPlayerId) continue;
                            if (!shouldInitiateCallTo(player.id)) continue;

                            const existingCall = callsRef.current.get(player.id);

                            if (!existingCall) {
                                console.log(`[Voice] No call to player ${player.id}, initiating`);
                                callPlayer(player.id);
                                continue;
                            }

                            const pc = existingCall.call.peerConnection;
                            const state = pc?.connectionState;
                            const iceState = pc?.iceConnectionState;
                            const age = now - existingCall.createdAt;

                            // Retry on genuine failure.
                            if (
                                (state && UNHEALTHY_STATES.has(state)) ||
                                (iceState && UNHEALTHY_STATES.has(iceState))
                            ) {
                                console.log(`[Voice] Call to ${player.id} unhealthy (${state}/${iceState}), retrying`);
                                cleanupCall(player.id);
                                callPlayer(player.id);
                                continue;
                            }

                            // Call stuck pre-negotiation for too long (no peerConnection,
                            // or stayed in 'new' beyond grace window). Treat as failed.
                            if ((!pc || state === 'new') && age > STALE_CALL_MS) {
                                console.log(`[Voice] Call to ${player.id} stale (${state ?? 'no-pc'}, ${age}ms), retrying`);
                                cleanupCall(player.id);
                                callPlayer(player.id);
                                continue;
                            }
                            // Otherwise: connecting or connected — leave alone.
                        }
                    } catch {
                        // Network hiccup on status poll; try again next tick.
                    }
                }, 5000);
            });

            // Handle incoming calls
            peer.on('call', (call) => {
                console.log(`[Voice] Incoming call from:`, call.peer);

                // Extract player ID from peer ID
                const match = call.peer.match(/player-(\d+)$/);
                const playerId = match ? parseInt(match[1], 10) : 0;

                if (playerId && localStreamRef.current) {
                    const streamToSend = buildSendStream();
                    if (!streamToSend) {
                        console.warn(`[Voice] No send stream available; cannot answer call from player ${playerId}`);
                        return;
                    }
                    console.log(`[Voice] Answering call from player ${playerId} with stream:`, streamToSend);
                    call.answer(streamToSend);

                    // Monitor ICE connection state for incoming calls
                    if (call.peerConnection) {
                        const updateConnectionState = () => {
                            const iceState = call.peerConnection.iceConnectionState;
                            const connectionState = call.peerConnection.connectionState;
                            console.log(`[Voice] ICE connection from player ${playerId}: ${iceState}, connection: ${connectionState}`);

                            setConnectionStates(prev => {
                                const next = new Map(prev);
                                next.set(playerId, { iceConnectionState: iceState, connectionState: connectionState || 'unknown' });
                                return next;
                            });

                            // Answerer side: on terminal failure, close the
                            // MediaConnection so the initiator's state also flips
                            // to failed and its retry loop kicks in. 'disconnected'
                            // is skipped — let the browser self-heal.
                            if (iceState === 'failed') {
                                console.log(`[Voice] Incoming call failed for player ${playerId}, cleaning up`);
                                cleanupCall(playerId);
                            }
                        };

                        call.peerConnection.addEventListener('iceconnectionstatechange', updateConnectionState);
                        call.peerConnection.addEventListener('connectionstatechange', updateConnectionState);
                        updateConnectionState();

                        // Listen for dynamically added tracks (e.g., when remote user enables video after connection)
                        call.peerConnection.addEventListener('track', (event) => {
                            console.log(`[Voice] Track event from player ${playerId} (incoming):`, {
                                kind: event.track.kind,
                                muted: event.track.muted,
                                enabled: event.track.enabled,
                                readyState: event.track.readyState,
                            });

                            if (event.track.kind === 'video') {
                                const track = event.track;
                                const stream = event.streams[0];

                                if (stream) {
                                    console.log(`[Voice] Adding video from player ${playerId} (incoming)`);
                                    setRemoteVideos(prev => {
                                        const next = new Map(prev);
                                        next.set(playerId, stream);
                                        return next;
                                    });
                                }
                                setRemoteVideoMuted(prev => new Map(prev).set(playerId, track.muted));

                                track.addEventListener('mute', () => {
                                    console.log(`[Voice] Video track muted from player ${playerId}`);
                                    setRemoteVideoMuted(prev => new Map(prev).set(playerId, true));
                                });

                                track.addEventListener('unmute', () => {
                                    console.log(`[Voice] Video track unmuted from player ${playerId}`);
                                    setRemoteVideoMuted(prev => new Map(prev).set(playerId, false));
                                    if (stream) {
                                        setRemoteVideos(prev => {
                                            const next = new Map(prev);
                                            next.set(playerId, stream);
                                            return next;
                                        });
                                    }
                                });

                                track.addEventListener('ended', () => {
                                    console.log(`[Voice] Video track ended from player ${playerId}`);
                                    setRemoteVideos(prev => {
                                        const next = new Map(prev);
                                        next.delete(playerId);
                                        return next;
                                    });
                                    setRemoteVideoMuted(prev => {
                                        const next = new Map(prev);
                                        next.delete(playerId);
                                        return next;
                                    });
                                });
                            }
                        });
                    }

                    call.on('stream', (remoteStream) => {
                        console.log(`[Voice] Received stream from incoming call, player ${playerId}`, remoteStream);
                        handleStream(remoteStream, playerId);
                    });

                    call.on('close', () => {
                        console.log(`[Voice] Incoming call closed with player ${playerId}`);
                        setConnectionStates(prev => {
                            const next = new Map(prev);
                            next.delete(playerId);
                            return next;
                        });
                        cleanupCall(playerId);
                    });

                    callsRef.current.set(playerId, { playerId, call, createdAt: Date.now() });
                }
            });

            peer.on('error', (err) => {
                if (err.type === 'unavailable-id') {
                    console.error('[Voice] Peer error:', err.type, err);
                    setError('Another session is already connected. Please close other tabs.');
                } else if (err.type === 'peer-unavailable') {
                    // Target peer isn't on the signalling server yet. PeerJS 1.5.5
                    // puts the peer id in err.message (e.g. "Could not connect to
                    // peer ROOMCODE-player-42"). Match the room-prefixed id so we
                    // don't accidentally match on an unrelated substring.
                    const peerIdPattern = new RegExp(`${roomCode}-player-(\\d+)`);
                    const match = err.message?.match(peerIdPattern);
                    const targetId = match ? parseInt(match[1], 10) : null;
                    console.log(`[Voice] peer-unavailable:`, { message: err.message, parsedTargetId: targetId });
                    if (targetId && callsRef.current.has(targetId)) {
                        console.log(`[Voice] Cleaning up stale call to player ${targetId} for retry`);
                        cleanupCall(targetId);
                    }
                } else {
                    console.error('[Voice] Peer error:', err.type, err);
                    setError(`Connection error: ${err.type}`);
                }
            });

            peer.on('disconnected', () => {
                console.log('[Voice] Peer disconnected from signal server');
            });

        } catch (err) {
            console.error('[Voice] Failed to connect:', err);
            setIsConnecting(false);
            setError('Failed to connect to voice server. Please try again.');
        }
    }, [gameSlug, roomCode, currentPlayerId, getPeerId, shouldInitiateCallTo, fetchVoiceStatus, callPlayer, handleStream, cleanupCall, buildSendStream]);

    // Disconnect from voice chat
    const disconnect = useCallback(() => {
        console.log('[Voice] Disconnecting from voice chat');

        if (statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
            statusPollingRef.current = null;
        }
        if (peerPollingRef.current) {
            clearInterval(peerPollingRef.current);
            peerPollingRef.current = null;
        }

        callsRef.current.forEach((_, playerId) => {
            cleanupCall(playerId);
        });

        // Tear down any analysers still alive (e.g., the local-mic one for
        // currentPlayerId, which has no entry in callsRef).
        Array.from(analysersRef.current.keys()).forEach(teardownAnalyser);

        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // Clean up video stream
        if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getTracks().forEach(track => track.stop());
            localVideoStreamRef.current = null;
        }

        // Clean up silent AudioContext if it exists
        if (silentAudioContextRef.current) {
            silentAudioContextRef.current.close();
            silentAudioContextRef.current = null;
        }

        // Stop the placeholder video track on disconnect.
        if (silentVideoTrackRef.current) {
            silentVideoTrackRef.current.stop();
            silentVideoTrackRef.current = null;
        }

        setIsConnected(false);
        setIsMuted(true);
        setIsVideoEnabled(false);
        setHasMicrophoneAccess(false);
        setHasCameraAccess(false);
        setSpeakingPlayers(new Set());
        setConnectionStates(new Map());
        setRemoteVideos(new Map());
        setRemoteVideoMuted(new Map());
        setLocalVideoStream(null);
    }, [cleanupCall, teardownAnalyser]);

    // Toggle mute
    const toggleMute = useCallback(async () => {
        if (!localStreamRef.current) return;

        // If we don't have mic access yet and trying to unmute, request it
        if (!hasMicrophoneAccess && isMuted) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

                console.log('[Voice] Got microphone access');

                // Replace tracks in all existing peer connections. Log per-peer
                // success/failure so we can diagnose remotes that hear silence
                // after a successful local unmute.
                const newTrack = stream.getAudioTracks()[0];
                callsRef.current.forEach(({ call, playerId }) => {
                    const pc = call.peerConnection;
                    const sender = pc?.getSenders().find(s => s.track?.kind === 'audio');
                    if (!sender) {
                        console.warn(`[Voice] No audio sender for player ${playerId}, cannot replace track`);
                        return;
                    }
                    sender.replaceTrack(newTrack)
                        .then(() => console.log(`[Voice] Replaced audio track for player ${playerId} (pc state: ${pc?.connectionState})`))
                        .catch(err => console.error(`[Voice] replaceTrack failed for player ${playerId}:`, err));
                });

                // Stop the old silent AUDIO tracks only — keep the placeholder
                // video track alive (silentVideoTrackRef still references it
                // and it's spliced into every active peer connection).
                localStreamRef.current.getAudioTracks().forEach(track => track.stop());

                // Clean up silent AudioContext
                if (silentAudioContextRef.current) {
                    silentAudioContextRef.current.close();
                    silentAudioContextRef.current = null;
                }

                // Update local stream reference (now real mic, no video tracks)
                localStreamRef.current = stream;
                setHasMicrophoneAccess(true);

                // Setup speaking indicator for real stream
                setupAudioLevelDetection(stream, currentPlayerId);

                // Enable the track (unmute)
                stream.getAudioTracks().forEach(track => {
                    track.enabled = true;
                });

                setIsMuted(false);
                console.log('[Voice] Microphone enabled and unmuted');

                try {
                    await axios.post(route('rooms.voice.toggleMute', [gameSlug, roomCode]));
                } catch {
                    // Silently fail
                }
                return;
            } catch (err) {
                console.error('[Voice] Failed to get microphone access:', err);
                if (err instanceof Error && err.name === 'NotAllowedError') {
                    setError('Microphone access denied. Click to try again.');
                } else {
                    setError('Failed to access microphone. Please try again.');
                }
                return; // Don't toggle mute if permission denied
            }
        }

        // Normal mute/unmute toggle (already have mic access)
        const newMutedState = !isMuted;
        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !newMutedState;
        });

        setIsMuted(newMutedState);
        console.log(`[Voice] Toggle mute: ${newMutedState ? 'muted' : 'unmuted'}, tracks enabled:`,
            localStreamRef.current.getAudioTracks()[0]?.enabled);

        try {
            await axios.post(route('rooms.voice.toggleMute', [gameSlug, roomCode]));
        } catch {
            // Silently fail
        }
    }, [hasMicrophoneAccess, isMuted, gameSlug, roomCode, currentPlayerId, setupAudioLevelDetection]);

    // Toggle video. Swaps the camera track in/out via replaceTrack on the
    // existing video sender (the placeholder is always there, so the m=video
    // line and sender are stable). No close-and-recreate, no audio gap.
    const toggleVideo = useCallback(async () => {
        if (!isConnected) return;

        // First-time enable: request camera permission, then swap.
        if (!hasCameraAccess && !isVideoEnabled) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 320 },
                        height: { ideal: 240 },
                        facingMode: 'user',
                    },
                });

                console.log('[Voice] Got camera access');
                localVideoStreamRef.current = stream;
                setLocalVideoStream(stream);
                setHasCameraAccess(true);
                setIsVideoEnabled(true);

                const realVideoTrack = stream.getVideoTracks()[0] ?? null;
                swapVideoTrack(realVideoTrack);

                try {
                    await axios.post(route('rooms.voice.toggleVideo', [gameSlug, roomCode]));
                } catch {
                    // Silently fail
                }
                return;
            } catch (err) {
                console.error('[Voice] Failed to get camera access:', err);
                if (err instanceof Error && err.name === 'NotAllowedError') {
                    setError('Camera access denied. Please allow camera in your browser settings.');
                } else {
                    setError('Failed to access camera. Please try again.');
                }
                return;
            }
        }

        // Subsequent toggle (already have camera access).
        const newVideoState = !isVideoEnabled;

        if (newVideoState) {
            // Re-enable the real camera track and swap it back in.
            if (localVideoStreamRef.current) {
                localVideoStreamRef.current.getVideoTracks().forEach(track => {
                    track.enabled = true;
                });
                const realVideoTrack = localVideoStreamRef.current.getVideoTracks()[0] ?? null;
                swapVideoTrack(realVideoTrack);
            }
        } else {
            // Disable the real track and put the placeholder back on the wire.
            if (localVideoStreamRef.current) {
                localVideoStreamRef.current.getVideoTracks().forEach(track => {
                    track.enabled = false;
                });
            }
            swapVideoTrack(silentVideoTrackRef.current);
        }

        setIsVideoEnabled(newVideoState);
        console.log(`[Voice] Toggle video: ${newVideoState ? 'enabled' : 'disabled'}`);

        try {
            await axios.post(route('rooms.voice.toggleVideo', [gameSlug, roomCode]));
        } catch {
            // Silently fail
        }
    }, [isConnected, hasCameraAccess, isVideoEnabled, gameSlug, roomCode, swapVideoTrack]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    // Initial fetch of players
    useEffect(() => {
        fetchVoiceStatus();
    }, [fetchVoiceStatus]);

    // Auto-connect on component mount
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        if (!isConnected && !autoConnectAttempted.current) {
            autoConnectAttempted.current = true;
            setIsConnecting(true);
            timeoutId = setTimeout(() => {
                connect();
            }, 500); // Delay to let page render first
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    const value = useMemo<VoiceChatContextValue>(() => ({
        isConnected,
        isConnecting,
        error,
        isMuted,
        isVideoEnabled,
        hasMicrophoneAccess,
        hasCameraAccess,
        toggleMute,
        toggleVideo,
        players,
        speakingPlayers,
        remoteVideos,
        remoteVideoMuted,
        connectionStates,
        localVideoStream,
        connect,
        disconnect,
    }), [
        isConnected,
        isConnecting,
        error,
        isMuted,
        isVideoEnabled,
        hasMicrophoneAccess,
        hasCameraAccess,
        toggleMute,
        toggleVideo,
        players,
        speakingPlayers,
        remoteVideos,
        remoteVideoMuted,
        connectionStates,
        localVideoStream,
        connect,
        disconnect,
    ]);

    return (
        <VoiceChatContext.Provider value={value}>
            {children}
        </VoiceChatContext.Provider>
    );
}

export function useVoiceChat(): VoiceChatContextValue {
    const context = useContext(VoiceChatContext);
    if (!context) {
        throw new Error('useVoiceChat must be used within a VoiceChatProvider');
    }
    return context;
}

// Optional hook that returns null if not in a VoiceChatProvider
export function useVoiceChatOptional(): VoiceChatContextValue | null {
    return useContext(VoiceChatContext);
}
