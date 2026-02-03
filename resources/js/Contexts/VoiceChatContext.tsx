import axios from 'axios';
import Peer, { MediaConnection } from 'peerjs';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

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
    audioElement?: HTMLAudioElement;
    videoElement?: HTMLVideoElement;
}

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
    const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);

    const peerRef = useRef<Peer | null>(null);
    const localVideoStreamRef = useRef<MediaStream | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callsRef = useRef<Map<number, CallData>>(new Map());
    const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const peerPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoConnectAttempted = useRef(false);
    const silentAudioContextRef = useRef<AudioContext | null>(null);

    // Generate unique peer ID for this player in this room
    const getPeerId = useCallback((playerId: number) => `${roomCode}-player-${playerId}`, [roomCode]);

    // Create a silent audio stream (no microphone permission required)
    const createSilentStream = (): MediaStream => {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        silentAudioContextRef.current = audioContext;

        const oscillator = audioContext.createOscillator();
        const dst = audioContext.createMediaStreamDestination();
        oscillator.connect(dst);
        oscillator.start();

        // Return the stream with muted tracks
        const stream = dst.stream;
        stream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
        return stream;
    };

    // Fetch voice status of all players
    const fetchVoiceStatus = useCallback(async () => {
        try {
            const response = await axios.get(route('rooms.voice.status', [gameSlug, roomCode]));
            setPlayers(response.data.players);
        } catch {
            // Silently fail
        }
    }, [gameSlug, roomCode]);

    // Setup audio level detection for speaking indicator
    const setupAudioLevelDetection = useCallback((stream: MediaStream, playerId: number) => {
        try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkLevel = () => {
                if (!callsRef.current.has(playerId) && playerId !== currentPlayerId) {
                    audioContext.close();
                    return;
                }

                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

                setSpeakingPlayers(prev => {
                    const next = new Set(prev);
                    if (average > 30) {
                        next.add(playerId);
                    } else {
                        next.delete(playerId);
                    }
                    return next;
                });

                requestAnimationFrame(checkLevel);
            };
            checkLevel();
        } catch (err) {
            console.error('Failed to setup audio level detection:', err);
        }
    }, [currentPlayerId]);

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

        // Remove remote video
        setRemoteVideos(prev => {
            const next = new Map(prev);
            next.delete(playerId);
            return next;
        });
    }, []);

    // Call another player
    const callPlayer = useCallback((playerId: number) => {
        if (!peerRef.current || !localStreamRef.current) return;

        // Don't call if already have an active call
        if (callsRef.current.has(playerId)) {
            console.log(`Already have call with player ${playerId}, skipping`);
            return;
        }

        const peerId = getPeerId(playerId);

        // Create stream with audio + video (if enabled)
        let streamToSend = localStreamRef.current;
        if (localVideoStreamRef.current && localVideoStreamRef.current.getVideoTracks().length > 0) {
            streamToSend = new MediaStream([
                ...localStreamRef.current.getTracks(),
                ...localVideoStreamRef.current.getTracks()
            ]);
        }

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

                    // Retry on failure
                    if (iceState === 'failed' || iceState === 'disconnected') {
                        console.log(`[Voice] Connection ${iceState} for player ${playerId}, will retry...`);
                        setTimeout(() => {
                            callsRef.current.delete(playerId);
                            callPlayer(playerId);
                        }, 2000);
                    }
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

                        // Always try to add video immediately (removed !track.muted check)
                        // The muted state can be temporary and doesn't mean no video data
                        if (stream) {
                            console.log(`[Voice] Adding video from player ${playerId}`);
                            setRemoteVideos(prev => {
                                const next = new Map(prev);
                                next.set(playerId, stream);
                                return next;
                            });
                        }

                        // Listen for track mute/unmute events
                        track.addEventListener('mute', () => {
                            console.log(`[Voice] Video track muted from player ${playerId}`);
                            // Don't remove - mute just means no data temporarily
                        });

                        track.addEventListener('unmute', () => {
                            console.log(`[Voice] Video track unmuted from player ${playerId}`);
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
                // Remove from calls so we can try again later
                callsRef.current.delete(playerId);
                setConnectionStates(prev => {
                    const next = new Map(prev);
                    next.delete(playerId);
                    return next;
                });
            });

            callsRef.current.set(playerId, { playerId, call });
        } catch (err) {
            console.error(`[Voice] Failed to call player ${playerId}:`, err);
        }
    }, [getPeerId, handleStream, cleanupCall]);

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
                        // Multiple STUN servers for reliability - these work for most connections
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        // Note: TURN servers removed - OpenRelay credentials may be rate-limited
                        // For production, consider setting up your own TURN server (coturn)
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

                // Call other players who are already connected
                for (const player of currentPlayers) {
                    if (player.id !== currentPlayerId) {
                        // Small delay between calls
                        setTimeout(() => callPlayer(player.id), 500);
                    }
                }

                // Poll for new players to call - also retry failed calls
                peerPollingRef.current = setInterval(async () => {
                    const res = await axios.get(route('rooms.voice.status', [gameSlug, roomCode]));
                    const players = res.data.players as VoicePlayer[];
                    for (const player of players) {
                        if (player.id !== currentPlayerId) {
                            const existingCall = callsRef.current.get(player.id);
                            // Call if no existing call, or if existing call has no audio element (failed)
                            if (!existingCall?.audioElement) {
                                // Remove failed call first
                                if (existingCall) {
                                    callsRef.current.delete(player.id);
                                }
                                console.log(`Retry calling player ${player.id}`);
                                callPlayer(player.id);
                            }
                        }
                    }
                }, 3000);
            });

            // Handle incoming calls
            peer.on('call', (call) => {
                console.log(`[Voice] Incoming call from:`, call.peer);

                // Extract player ID from peer ID
                const match = call.peer.match(/player-(\d+)$/);
                const playerId = match ? parseInt(match[1], 10) : 0;

                if (playerId && localStreamRef.current) {
                    // Create stream with audio + video (if enabled)
                    let streamToSend = localStreamRef.current;
                    if (localVideoStreamRef.current && localVideoStreamRef.current.getVideoTracks().length > 0) {
                        streamToSend = new MediaStream([
                            ...localStreamRef.current.getTracks(),
                            ...localVideoStreamRef.current.getTracks()
                        ]);
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

                                // Always try to add video immediately (removed !track.muted check)
                                // The muted state can be temporary and doesn't mean no video data
                                if (stream) {
                                    console.log(`[Voice] Adding video from player ${playerId} (incoming)`);
                                    setRemoteVideos(prev => {
                                        const next = new Map(prev);
                                        next.set(playerId, stream);
                                        return next;
                                    });
                                }

                                // Listen for track mute/unmute events
                                track.addEventListener('mute', () => {
                                    console.log(`[Voice] Video track muted from player ${playerId}`);
                                    // Don't remove - mute just means no data temporarily
                                });

                                track.addEventListener('unmute', () => {
                                    console.log(`[Voice] Video track unmuted from player ${playerId}`);
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

                    callsRef.current.set(playerId, { playerId, call });
                }
            });

            peer.on('error', (err) => {
                console.error('[Voice] Peer error:', err.type, err);
                if (err.type === 'unavailable-id') {
                    setError('Another session is already connected. Please close other tabs.');
                } else if (err.type === 'peer-unavailable') {
                    // This is normal - the other peer might not be connected yet
                    console.log('[Voice] Peer not available yet, will retry...');
                } else {
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
    }, [gameSlug, roomCode, currentPlayerId, getPeerId, fetchVoiceStatus, callPlayer, handleStream, cleanupCall]);

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

        setIsConnected(false);
        setIsMuted(true);
        setIsVideoEnabled(false);
        setHasMicrophoneAccess(false);
        setHasCameraAccess(false);
        setSpeakingPlayers(new Set());
        setConnectionStates(new Map());
        setRemoteVideos(new Map());
        setLocalVideoStream(null);
    }, [cleanupCall]);

    // Re-establish all calls (used when video state changes)
    const reestablishCalls = useCallback(() => {
        if (!peerRef.current || !localStreamRef.current) return;

        const videoTrack = localVideoStreamRef.current?.getVideoTracks()[0] || null;
        console.log('[Voice] Updating video track on existing calls:', videoTrack ? 'adding' : 'removing');

        callsRef.current.forEach(({ call, playerId }) => {
            if (!call.peerConnection) {
                console.log(`[Voice] No peerConnection for player ${playerId}, skipping`);
                return;
            }

            const senders = call.peerConnection.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video' || (s.track === null && !senders.some(other => other !== s && other.track?.kind === 'video')));

            console.log(`[Voice] Player ${playerId} senders:`, senders.map(s => ({ kind: s.track?.kind, id: s.track?.id })));

            if (videoTrack) {
                if (videoSender && videoSender.track?.kind === 'video') {
                    // Replace existing video track
                    videoSender.replaceTrack(videoTrack)
                        .then(() => console.log(`[Voice] Replaced video track for player ${playerId}`))
                        .catch(err => console.error(`[Voice] Failed to replace track for player ${playerId}:`, err));
                } else {
                    // Need to add a new track - this requires renegotiation
                    // Fall back to re-establishing this specific call
                    console.log(`[Voice] No video sender for player ${playerId}, re-calling`);
                    call.close();
                    callsRef.current.delete(playerId);
                    // Also remove remote video for this player
                    setRemoteVideos(prev => {
                        const next = new Map(prev);
                        next.delete(playerId);
                        return next;
                    });
                    setTimeout(() => callPlayer(playerId), 500);
                }
            } else if (videoSender?.track) {
                // Remove video by replacing with null
                videoSender.replaceTrack(null)
                    .then(() => console.log(`[Voice] Removed video track for player ${playerId}`))
                    .catch(err => console.error(`[Voice] Failed to remove track for player ${playerId}:`, err));
            }
        });
    }, [callPlayer]);

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

                // Replace tracks in all existing peer connections
                const newTrack = stream.getAudioTracks()[0];
                callsRef.current.forEach(({ call }) => {
                    const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'audio');
                    if (sender) {
                        sender.replaceTrack(newTrack);
                        console.log('[Voice] Replaced audio track in peer connection');
                    }
                });

                // Stop the old silent stream tracks
                localStreamRef.current.getTracks().forEach(track => track.stop());

                // Clean up silent AudioContext
                if (silentAudioContextRef.current) {
                    silentAudioContextRef.current.close();
                    silentAudioContextRef.current = null;
                }

                // Update local stream reference
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

    // Toggle video
    const toggleVideo = useCallback(async () => {
        if (!isConnected) return;

        // If we don't have camera access yet and trying to enable video, request it
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

                // Re-establish all calls to include video
                reestablishCalls();

                // Sync state with backend
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

        // Normal video toggle (already have camera access)
        const newVideoState = !isVideoEnabled;

        if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = newVideoState;
            });
        }

        setIsVideoEnabled(newVideoState);
        console.log(`[Voice] Toggle video: ${newVideoState ? 'enabled' : 'disabled'}`);

        // Re-establish calls to update video state
        reestablishCalls();

        // Sync state with backend
        try {
            await axios.post(route('rooms.voice.toggleVideo', [gameSlug, roomCode]));
        } catch {
            // Silently fail
        }
    }, [isConnected, hasCameraAccess, isVideoEnabled, gameSlug, roomCode, reestablishCalls]);

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

    const value: VoiceChatContextValue = {
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
        connectionStates,
        localVideoStream,
        connect,
        disconnect,
    };

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
