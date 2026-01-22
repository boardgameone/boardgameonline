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
    roomCode: string;
    currentPlayerId: number;
}

interface CallData {
    playerId: number;
    call: MediaConnection;
    audioElement?: HTMLAudioElement;
}

export default function VoiceChat({ roomCode, currentPlayerId }: Readonly<Props>) {
    const [isOpen, setIsOpen] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [players, setPlayers] = useState<VoicePlayer[]>([]);
    const [speakingPlayers, setSpeakingPlayers] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>('');

    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callsRef = useRef<Map<number, CallData>>(new Map());
    const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const peerPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Generate unique peer ID for this player in this room
    const getPeerId = (playerId: number) => `${roomCode}-player-${playerId}`;

    // Fetch voice status of all players
    const fetchVoiceStatus = useCallback(async () => {
        try {
            const response = await axios.get(route('rooms.voice.status', roomCode));
            setPlayers(response.data.players);
        } catch {
            // Silently fail
        }
    }, [roomCode]);

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
        console.log(`Received stream from player ${playerId}`);
        console.log(`Stream tracks:`, stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
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
        // Make sure audio is not muted
        audioElement.muted = false;
        document.body.appendChild(audioElement);

        // Debug: Log audio element state
        console.log(`Audio element created for player ${playerId}:`, {
            volume: audioElement.volume,
            muted: audioElement.muted,
            paused: audioElement.paused,
        });

        // Play audio
        audioElement.play()
            .then(() => {
                console.log(`Audio playing for player ${playerId}, paused:`, audioElement.paused);
            })
            .catch((err) => {
                console.error(`Failed to play audio:`, err);
                // Retry on click
                const clickHandler = () => {
                    audioElement.play();
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
        console.log(`Calling player ${playerId} (${peerId})`);

        try {
            const call = peerRef.current.call(peerId, localStreamRef.current);

            call.on('stream', (remoteStream) => {
                handleStream(remoteStream, playerId);
            });

            call.on('close', () => {
                console.log(`Call closed with player ${playerId}`);
                cleanupCall(playerId);
            });

            call.on('error', (err) => {
                console.error(`Call error with player ${playerId}:`, err);
                // Remove from calls so we can try again later
                callsRef.current.delete(playerId);
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

            // Mute by default
            stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });

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
                    ],
                },
            });

            peerRef.current = peer;

            peer.on('open', async (id) => {
                console.log(`Peer connected with ID: ${id}`);
                setIsConnected(true);
                setIsMuted(true);
                setConnectionStatus('Connected to peer server');

                // Start polling for player status
                statusPollingRef.current = setInterval(fetchVoiceStatus, 3000);

                // Fetch current players
                const response = await axios.get(route('rooms.voice.status', roomCode));
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
                    const res = await axios.get(route('rooms.voice.status', roomCode));
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
                console.log(`Incoming call from: ${call.peer}`);

                // Extract player ID from peer ID
                const match = call.peer.match(/player-(\d+)$/);
                const playerId = match ? parseInt(match[1], 10) : 0;

                if (playerId && localStreamRef.current) {
                    call.answer(localStreamRef.current);

                    call.on('stream', (remoteStream) => {
                        handleStream(remoteStream, playerId);
                    });

                    call.on('close', () => {
                        console.log(`Call closed with player ${playerId}`);
                        cleanupCall(playerId);
                    });

                    callsRef.current.set(playerId, { playerId, call });
                }
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    setError('Another session is already connected. Please close other tabs.');
                } else if (err.type === 'peer-unavailable') {
                    // This is normal - the other peer might not be connected yet
                    console.log('Peer not available yet, will retry...');
                } else {
                    setError(`Connection error: ${err.type}`);
                }
            });

            peer.on('disconnected', () => {
                console.log('Peer disconnected');
                setConnectionStatus('Disconnected from peer server');
            });

        } catch (err) {
            console.error('Failed to connect:', err);
            setError('Failed to access microphone. Please allow microphone access.');
            setConnectionStatus('Failed');
        }
    };

    // Disconnect from voice chat
    const disconnect = useCallback(() => {
        console.log('Disconnecting from voice chat');

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
    }, [cleanupCall]);

    // Toggle mute
    const toggleMute = async () => {
        if (!localStreamRef.current) return;

        const newMutedState = !isMuted;
        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !newMutedState;
            console.log(`Audio track enabled: ${track.enabled}`);
        });

        setIsMuted(newMutedState);
        console.log(`Mute toggled: ${newMutedState ? 'muted' : 'unmuted'}`);

        try {
            await axios.post(route('rooms.voice.toggleMute', roomCode));
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

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between"
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

                    {connectionStatus && (
                        <div className="mb-2 text-xs text-gray-500">
                            Status: {connectionStatus}
                        </div>
                    )}

                    {/* Connect/Disconnect Button */}
                    {!isConnected ? (
                        <button
                            onClick={connect}
                            className="w-full rounded-full bg-green-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-700 border-b-4 border-green-800 flex items-center justify-center gap-2"
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
                                            : 'bg-green-500 text-white border-b-4 border-green-700'
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
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 01-3 3z" />
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
                                                    <span className="text-green-600"> (You)</span>
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
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 01-3 3z" />
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
