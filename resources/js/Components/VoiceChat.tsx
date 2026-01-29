import axios from 'axios';
import Peer, { MediaConnection } from 'peerjs';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VoicePlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_muted: boolean;
}

interface Props {
    gameSlug: string;
    roomCode: string;
    currentPlayerId: number;
}

interface ConnectionState {
    iceConnectionState: string;
    connectionState: string;
}

interface CallData {
    playerId: number;
    call: MediaConnection;
    audioElement?: HTMLAudioElement;
}

export default function VoiceChat({ gameSlug, roomCode, currentPlayerId }: Readonly<Props>) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [players, setPlayers] = useState<VoicePlayer[]>([]);
    const [speakingPlayers, setSpeakingPlayers] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>('');
    const [connectionStates, setConnectionStates] = useState<Map<number, ConnectionState>>(new Map());
    const [isConnecting, setIsConnecting] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);

    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callsRef = useRef<Map<number, CallData>>(new Map());
    const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const peerPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoConnectAttempted = useRef(false);

    // Generate unique peer ID for this player in this room
    const getPeerId = (playerId: number) => `${roomCode}-player-${playerId}`;

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
        const tracks = stream.getAudioTracks();
        console.log(`[Voice] Received stream from player ${playerId}`, {
            tracks: tracks.length,
            enabled: tracks[0]?.enabled,
            readyState: tracks[0]?.readyState,
            muted: tracks[0]?.muted,
        });
        setConnectionStatus(`Receiving audio from player ${playerId}`);

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
            callsRef.current.delete(playerId);
        }
        const existingAudio = document.getElementById(`audio-${playerId}`);
        if (existingAudio) {
            existingAudio.remove();
        }
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
        console.log(`[Voice] Calling player ${playerId} (${peerId}) with stream:`, localStreamRef.current);

        try {
            const call = peerRef.current.call(peerId, localStreamRef.current);

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
            console.error(`Failed to call player ${playerId}:`, err);
        }
    }, [handleStream, cleanupCall]);

    // Connect to voice chat
    const connect = async () => {
        try {
            setError(null);
            setConnectionStatus('Getting microphone...');

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            console.log('Got microphone access');
            localStreamRef.current = stream;

            // Start muted by default
            stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
            console.log('[Voice] Local audio tracks disabled (muted by default)');

            // Setup local speaking indicator
            setupAudioLevelDetection(stream, currentPlayerId);

            setConnectionStatus('Connecting to peer server...');

            // Create peer with unique ID
            const myPeerId = getPeerId(currentPlayerId);
            console.log(`Creating peer with ID: ${myPeerId}`);

            const peer = new Peer(myPeerId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        // TURN servers for NAT/firewall traversal
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject',
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject',
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                            username: 'openrelayproject',
                            credential: 'openrelayproject',
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
                setConnectionStatus('Connected');

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
                    console.log(`[Voice] Answering call from player ${playerId} with stream:`, localStreamRef.current);
                    call.answer(localStreamRef.current);

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
                setConnectionStatus('Disconnected from peer server');
            });

        } catch (err) {
            console.error('[Voice] Failed to connect:', err);
            setIsConnecting(false);

            // Check for permission denial
            if (err instanceof Error && err.name === 'NotAllowedError') {
                setPermissionDenied(true);
                setError('Microphone access denied. You can still play without voice chat.');
            } else {
                setError('Failed to access microphone. Please allow microphone access.');
            }
            setConnectionStatus('Failed');
        }
    };

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

        setIsConnected(false);
        setIsMuted(true);
        setSpeakingPlayers(new Set());
        setConnectionStatus('');
        setConnectionStates(new Map());
    }, [cleanupCall]);

    // Toggle mute
    const toggleMute = async () => {
        if (!localStreamRef.current) return;

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
    };

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

    // Minimized floating button
    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className={`fixed bottom-24 right-4 z-40 rounded-full p-4 shadow-2xl hover:scale-110 transition-transform ${
                    isConnected
                        ? 'bg-gradient-to-r from-brand-cyan to-brand-teal text-white'
                        : 'bg-gray-300 text-gray-600'
                }`}
                title="Voice Chat (Always On)"
            >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {isConnected && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                        {players.length}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-24 right-4 z-40 w-80 bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-cyan to-brand-teal px-4 py-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {'\u{1F3A4}'} Voice
                    {isConnected && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                            On
                        </span>
                    )}
                </h3>
                <button
                    onClick={() => setIsMinimized(true)}
                    className="text-white/80 hover:text-white transition"
                    title="Minimize"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            <div className="max-h-[40vh] overflow-y-auto">
                <div className="p-4">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Connecting status */}
                    {isConnecting && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-blue-800">Connecting to voice chat...</p>
                        </div>
                    )}

                    {/* Permission denied message */}
                    {permissionDenied && !isConnected && (
                        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                            <p className="text-sm text-yellow-800 mb-2">
                                Microphone access is required for voice chat. You can still play without it.
                            </p>
                            <button
                                onClick={() => {
                                    setPermissionDenied(false);
                                    autoConnectAttempted.current = false;
                                    setIsConnecting(true);
                                    connect();
                                }}
                                className="w-full rounded-full bg-yellow-500 px-4 py-2 font-bold text-white shadow-md transition hover:scale-105 hover:bg-yellow-600"
                            >
                                Retry Microphone Access
                            </button>
                        </div>
                    )}

                    {/* Connected status (brief) */}
                    {connectionStatus && isConnected && (
                        <div className="mb-2 text-xs text-green-600 font-medium">
                            {connectionStatus}
                        </div>
                    )}

                    {/* Mute/Unmute Button - shown when connected */}
                    {isConnected && (
                        <div className="space-y-4">
                            {/* Mute Control */}
                            <button
                                onClick={toggleMute}
                                className={`w-full rounded-full px-6 py-3 font-bold shadow-lg transition hover:scale-105 flex items-center justify-center gap-2 border-b-4 ${
                                    isMuted
                                        ? 'bg-red-500 text-white border-red-700 hover:bg-red-600'
                                        : 'bg-green-500 text-white border-green-700 hover:bg-green-600'
                                }`}
                            >
                                {isMuted ? (
                                    <>
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                        </svg>
                                        Unmute Microphone
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        Mute Microphone
                                    </>
                                )}
                            </button>

                            {/* Players List */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-500 uppercase">In Voice</p>
                                {players.map((player) => {
                                    const connState = connectionStates.get(player.id);
                                    const isActuallyConnected = connState?.iceConnectionState === 'connected' ||
                                        connState?.iceConnectionState === 'completed';
                                    const isConnecting = connState?.iceConnectionState === 'checking' ||
                                        connState?.iceConnectionState === 'new';

                                    return (
                                        <div
                                            key={player.id}
                                            className={`flex items-center gap-3 p-2 rounded-xl transition ${
                                                speakingPlayers.has(player.id)
                                                    ? 'bg-green-50 ring-2 ring-green-400'
                                                    : 'bg-gray-50'
                                            }`}
                                        >
                                            <div
                                                className={`relative flex h-10 w-10 items-center justify-center rounded-full text-white font-bold shadow-sm ${
                                                    speakingPlayers.has(player.id) ? 'animate-pulse' : ''
                                                }`}
                                                style={{ backgroundColor: player.avatar_color }}
                                            >
                                                {player.nickname.charAt(0).toUpperCase()}
                                                {speakingPlayers.has(player.id) && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 truncate text-sm">
                                                    {player.nickname}
                                                    {player.id === currentPlayerId && (
                                                        <span className="text-green-600"> (You)</span>
                                                    )}
                                                </p>
                                                {player.id !== currentPlayerId && connState && (
                                                    <p className="text-xs text-gray-500">
                                                        {isActuallyConnected && '🟢 Connected'}
                                                        {isConnecting && '🟡 Connecting...'}
                                                        {!isActuallyConnected && !isConnecting && `🔴 ${connState.iceConnectionState}`}
                                                    </p>
                                                )}
                                            </div>
                                            {player.is_muted ? (
                                                <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                                </svg>
                                            ) : (
                                                <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 01-3 3z" />
                                                </svg>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
