import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VoicePlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_muted: boolean;
}

interface Props {
    roomCode: string;
    currentPlayerId: number;
}

interface PeerConnection {
    playerId: number;
    connection: RTCPeerConnection;
    audioElement?: HTMLAudioElement;
}

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export default function VoiceChat({ roomCode, currentPlayerId }: Readonly<Props>) {
    const [isOpen, setIsOpen] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [players, setPlayers] = useState<VoicePlayer[]>([]);
    const [speakingPlayers, setSpeakingPlayers] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<number, PeerConnection>>(new Map());
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const signalPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch voice status of all players
    const fetchVoiceStatus = useCallback(async () => {
        try {
            const response = await axios.get(route('rooms.voice.status', roomCode));
            setPlayers(response.data.players);
        } catch {
            // Silently fail
        }
    }, [roomCode]);

    // Create peer connection for a player
    const createPeerConnection = useCallback((playerId: number): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Add local tracks to connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    await axios.post(route('rooms.voice.signal', roomCode), {
                        to_player_id: playerId,
                        type: 'ice-candidate',
                        payload: { candidate: event.candidate.toJSON() },
                    });
                } catch {
                    // Silently fail
                }
            }
        };

        // Handle remote tracks
        pc.ontrack = (event) => {
            // Remove any existing audio element for this player
            const existingAudio = document.getElementById(`audio-${playerId}`);
            if (existingAudio) {
                existingAudio.remove();
            }

            const audioElement = document.createElement('audio');
            audioElement.srcObject = event.streams[0];
            audioElement.autoplay = true;
            audioElement.volume = 1;
            audioElement.id = `audio-${playerId}`;
            document.body.appendChild(audioElement);

            // Explicitly play the audio - required for browsers to actually play
            const playAudio = () => {
                audioElement.play().catch(console.error);
                document.removeEventListener('click', playAudio);
            };

            audioElement.play().then(() => {
                console.log(`Audio playing for player ${playerId}`);
            }).catch((err) => {
                console.error('Failed to play audio:', err);
                // Retry play on user interaction if autoplay was blocked
                document.addEventListener('click', playAudio);
            });

            // Update peer connection with audio element
            const peerConn = peerConnectionsRef.current.get(playerId);
            if (peerConn) {
                peerConn.audioElement = audioElement;
            }

            // Set up audio level detection for speaking indicator
            setupAudioLevelDetection(event.streams[0], playerId);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                console.log(`Connected to player ${playerId}`);
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                console.log(`Disconnected from player ${playerId}`);
                cleanupPeerConnection(playerId);
            }
        };

        peerConnectionsRef.current.set(playerId, { playerId, connection: pc });
        return pc;
    }, [roomCode]);

    // Setup audio level detection for speaking indicator
    const setupAudioLevelDetection = (stream: MediaStream, playerId: number) => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkLevel = () => {
            if (!peerConnectionsRef.current.has(playerId)) return;

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
    };

    // Clean up peer connection
    const cleanupPeerConnection = (playerId: number) => {
        const peerConn = peerConnectionsRef.current.get(playerId);
        if (peerConn) {
            peerConn.connection.close();
            if (peerConn.audioElement) {
                peerConn.audioElement.remove();
            }
            peerConnectionsRef.current.delete(playerId);
        }
    };

    // Process incoming signals
    const processSignals = useCallback(async () => {
        if (!isConnected) return;

        try {
            const response = await axios.get(route('rooms.voice.signals', roomCode));
            const signals = response.data.signals;

            for (const signal of signals) {
                const { from_player_id, type, payload } = signal;

                let pc = peerConnectionsRef.current.get(from_player_id)?.connection;

                if (type === 'offer') {
                    // Create new connection if needed
                    if (!pc) {
                        pc = createPeerConnection(from_player_id);
                    }

                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    await axios.post(route('rooms.voice.signal', roomCode), {
                        to_player_id: from_player_id,
                        type: 'answer',
                        payload: { sdp: answer },
                    });
                } else if (type === 'answer') {
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    }
                } else if (type === 'ice-candidate') {
                    if (pc && payload.candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    }
                }
            }
        } catch {
            // Silently fail
        }
    }, [roomCode, isConnected, createPeerConnection]);

    // Connect to voice chat
    const connect = async () => {
        try {
            setError(null);

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            localStreamRef.current = stream;

            // Mute by default
            stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });

            // Setup local audio analysis for speaking indicator
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            setIsConnected(true);
            setIsMuted(true);

            // Fetch current players and initiate connections
            const response = await axios.get(route('rooms.voice.status', roomCode));
            const currentPlayers = response.data.players as VoicePlayer[];
            setPlayers(currentPlayers);

            // Initiate connections with other players
            for (const player of currentPlayers) {
                if (player.id !== currentPlayerId) {
                    const pc = createPeerConnection(player.id);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    await axios.post(route('rooms.voice.signal', roomCode), {
                        to_player_id: player.id,
                        type: 'offer',
                        payload: { sdp: offer },
                    });
                }
            }

            // Start polling for signals
            signalPollingRef.current = setInterval(processSignals, 1000);
            statusPollingRef.current = setInterval(fetchVoiceStatus, 3000);

        } catch (err) {
            console.error('Failed to connect:', err);
            setError('Failed to access microphone. Please allow microphone access.');
        }
    };

    // Disconnect from voice chat
    const disconnect = () => {
        // Stop polling
        if (signalPollingRef.current) {
            clearInterval(signalPollingRef.current);
            signalPollingRef.current = null;
        }
        if (statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
            statusPollingRef.current = null;
        }

        // Close all peer connections
        peerConnectionsRef.current.forEach((_, playerId) => {
            cleanupPeerConnection(playerId);
        });

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        setIsConnected(false);
        setIsMuted(true);
        setSpeakingPlayers(new Set());
    };

    // Toggle mute
    const toggleMute = async () => {
        if (!localStreamRef.current) return;

        const newMutedState = !isMuted;
        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !newMutedState;
        });

        setIsMuted(newMutedState);

        try {
            await axios.post(route('rooms.voice.toggleMute', roomCode));
        } catch {
            // Silently fail
        }
    };

    // Monitor local speaking
    useEffect(() => {
        if (!isConnected || !analyserRef.current || isMuted) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        let animationId: number;

        const checkLevel = () => {
            if (!analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

            setSpeakingPlayers(prev => {
                const next = new Set(prev);
                if (average > 30) {
                    next.add(currentPlayerId);
                } else {
                    next.delete(currentPlayerId);
                }
                return next;
            });

            animationId = requestAnimationFrame(checkLevel);
        };
        checkLevel();

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [isConnected, isMuted, currentPlayerId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, []);

    // Initial fetch of players
    useEffect(() => {
        fetchVoiceStatus();
    }, [fetchVoiceStatus]);

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between"
            >
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {'\u{1F3A4}'} Voice Chat
                    {isConnected && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                            Connected
                        </span>
                    )}
                </h3>
                <svg
                    className={`h-5 w-5 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="p-4">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Connect/Disconnect Button */}
                    {!isConnected ? (
                        <button
                            onClick={connect}
                            className="w-full rounded-full bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800 flex items-center justify-center gap-2"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            Join Voice
                        </button>
                    ) : (
                        <div className="space-y-4">
                            {/* Controls */}
                            <div className="flex gap-3">
                                <button
                                    onClick={toggleMute}
                                    className={`flex-1 rounded-full px-4 py-3 font-bold shadow-md transition hover:scale-105 flex items-center justify-center gap-2 ${
                                        isMuted
                                            ? 'bg-red-500 text-white border-b-4 border-red-700'
                                            : 'bg-blue-500 text-white border-b-4 border-blue-700'
                                    }`}
                                >
                                    {isMuted ? (
                                        <>
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                            </svg>
                                            Unmute
                                        </>
                                    ) : (
                                        <>
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                            </svg>
                                            Mute
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={disconnect}
                                    className="rounded-full bg-gray-200 px-4 py-3 font-bold text-gray-700 shadow-md transition hover:scale-105 hover:bg-gray-300 border-b-4 border-gray-400"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>

                            {/* Players List */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-500 uppercase">In Voice</p>
                                {players.map((player) => (
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
                                                    <span className="text-blue-600"> (You)</span>
                                                )}
                                            </p>
                                        </div>
                                        {player.is_muted ? (
                                            <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                            </svg>
                                        ) : (
                                            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                            </svg>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
