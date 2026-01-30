import { useVoiceChatOptional } from '@/Contexts/VoiceChatContext';
import GameIcon from '@/Components/GameIcon';
import VideoModal from '@/Components/VideoModal';
import { useEffect, useRef, useState } from 'react';

interface PlayerCardPlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_host?: boolean;
    is_connected?: boolean;
    is_muted?: boolean;
    is_video_enabled?: boolean;
}

interface PlayerCardProps {
    player: PlayerCardPlayer;
    currentPlayerId: number;
    showVoiceControls?: boolean;
    compact?: boolean;
}

export default function PlayerCard({
    player,
    currentPlayerId,
    showVoiceControls = false,
    compact = false,
}: PlayerCardProps) {
    const voiceChat = useVoiceChatOptional();
    const videoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [showVideoModal, setShowVideoModal] = useState(false);

    const isCurrentUser = player.id === currentPlayerId;

    // Get voice state from context if available
    const isSpeaking = voiceChat?.speakingPlayers.has(player.id) ?? false;
    const remoteVideoStream = voiceChat?.remoteVideos.get(player.id);
    const localVideoStream = voiceChat?.localVideoStream;

    // Get voice player data from context
    const voicePlayer = voiceChat?.players.find(p => p.id === player.id);
    const playerIsMuted = voicePlayer?.is_muted ?? player.is_muted ?? true;
    const playerHasVideo = voicePlayer?.is_video_enabled ?? player.is_video_enabled ?? false;

    // For current user, use context state directly
    const currentUserIsMuted = isCurrentUser ? (voiceChat?.isMuted ?? true) : playerIsMuted;
    const currentUserHasVideo = isCurrentUser ? (voiceChat?.isVideoEnabled ?? false) : playerHasVideo;

    // Show video when we have a video stream (don't wait for backend flag - WebRTC is real-time)
    const showRemoteVideo = !isCurrentUser && remoteVideoStream;
    const showLocalVideo = isCurrentUser && localVideoStream && currentUserHasVideo;
    const hasVideo = showRemoteVideo || showLocalVideo;

    // Set video srcObject for remote video
    useEffect(() => {
        if (videoRef.current && remoteVideoStream && showRemoteVideo) {
            videoRef.current.srcObject = remoteVideoStream;
        }
    }, [remoteVideoStream, showRemoteVideo]);

    // Set video srcObject for local video
    useEffect(() => {
        if (localVideoRef.current && localVideoStream && showLocalVideo) {
            localVideoRef.current.srcObject = localVideoStream;
        }
    }, [localVideoStream, showLocalVideo]);

    const handleToggleMute = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (voiceChat && isCurrentUser) {
            await voiceChat.toggleMute();
        }
    };

    const handleToggleVideo = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (voiceChat && isCurrentUser) {
            await voiceChat.toggleVideo();
        }
    };

    const handleVideoClick = () => {
        if (hasVideo) {
            setShowVideoModal(true);
        }
    };

    const canShowVoiceControls = showVoiceControls && voiceChat?.isConnected;

    // Determine stream and mute state for the modal
    const modalStream = isCurrentUser ? localVideoStream : remoteVideoStream;
    const modalIsMuted = isCurrentUser ? currentUserIsMuted : playerIsMuted;

    return (
        <>
            <div
                className={`flex items-center gap-3 rounded-xl transition ${
                    compact ? 'p-2' : 'p-4'
                } ${
                    isCurrentUser
                        ? 'bg-blue-100 border-2 border-blue-400'
                        : 'bg-gray-50 border-2 border-transparent'
                } ${
                    isSpeaking && canShowVoiceControls ? 'ring-2 ring-green-400' : ''
                }`}
            >
                {/* Avatar / Video Area */}
                <div
                    className={`relative ${compact ? 'h-10 w-10' : 'h-12 w-12'} flex-shrink-0 ${
                        hasVideo ? 'cursor-pointer group' : ''
                    }`}
                    onClick={handleVideoClick}
                    title={hasVideo ? 'Click to maximize' : undefined}
                >
                    {/* Remote Video Feed */}
                    {showRemoteVideo && (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`absolute inset-0 object-cover rounded-full scale-x-[-1] ${
                                    compact ? 'h-10 w-10' : 'h-12 w-12'
                                }`}
                            />
                            {/* Maximize overlay on hover */}
                            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <MaximizeIcon className="h-5 w-5 text-white" />
                            </div>
                        </>
                    )}

                    {/* Local Video Preview (for current user) */}
                    {showLocalVideo && (
                        <>
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`absolute inset-0 object-cover rounded-full scale-x-[-1] ${
                                    compact ? 'h-10 w-10' : 'h-12 w-12'
                                }`}
                            />
                            {/* Maximize overlay on hover */}
                            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <MaximizeIcon className="h-5 w-5 text-white" />
                            </div>
                        </>
                    )}

                    {/* Avatar (shown when no video) */}
                    {!showRemoteVideo && !showLocalVideo && (
                        <div
                            className={`flex items-center justify-center rounded-full text-white font-bold shadow-md ${
                                compact ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-lg'
                            } ${isSpeaking && canShowVoiceControls ? 'animate-pulse' : ''}`}
                            style={{ backgroundColor: player.avatar_color }}
                        >
                            {player.nickname.charAt(0).toUpperCase()}
                        </div>
                    )}

                    {/* Speaking indicator dot */}
                    {isSpeaking && canShowVoiceControls && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                    <p className={`font-bold text-gray-900 truncate ${compact ? 'text-sm' : ''}`}>
                        {player.nickname}
                        {isCurrentUser && <span className="text-blue-600"> (You)</span>}
                    </p>
                    {player.is_host && (
                        <span className="inline-flex items-center text-xs text-yellow-600 font-bold">
                            <GameIcon name="crown" size="xs" className="inline-block mr-1" /> Host
                        </span>
                    )}
                </div>

                {/* Voice/Video Controls or Status */}
                {canShowVoiceControls && (
                    <div className="flex items-center gap-2">
                        {isCurrentUser ? (
                            /* Current user: Interactive toggle buttons */
                            <>
                                <button
                                    onClick={handleToggleMute}
                                    className={`p-2 rounded-full transition hover:scale-110 ${
                                        currentUserIsMuted
                                            ? 'bg-red-500 text-white'
                                            : 'bg-green-500 text-white'
                                    }`}
                                    title={currentUserIsMuted ? 'Unmute microphone' : 'Mute microphone'}
                                >
                                    {currentUserIsMuted ? (
                                        <MicOffIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                    ) : (
                                        <MicOnIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                    )}
                                </button>
                                <button
                                    onClick={handleToggleVideo}
                                    className={`p-2 rounded-full transition hover:scale-110 ${
                                        currentUserHasVideo
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-600 text-white'
                                    }`}
                                    title={currentUserHasVideo ? 'Turn off camera' : 'Turn on camera'}
                                >
                                    {currentUserHasVideo ? (
                                        <VideoOnIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                    ) : (
                                        <VideoOffIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                    )}
                                </button>
                            </>
                        ) : (
                            /* Other players: Status indicators only */
                            <>
                                {playerHasVideo && (
                                    <span className="text-blue-500" title="Video enabled">
                                        <VideoOnIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                    </span>
                                )}
                                <span
                                    className={playerIsMuted ? 'text-red-400' : 'text-green-500'}
                                    title={playerIsMuted ? 'Muted' : 'Unmuted'}
                                >
                                    {playerIsMuted ? (
                                        <MicOffIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                    ) : (
                                        <MicOnIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                    )}
                                </span>
                            </>
                        )}
                    </div>
                )}

                {/* Online indicator (when voice controls not shown) */}
                {!canShowVoiceControls && player.is_connected !== undefined && (
                    <span
                        className={`h-3 w-3 rounded-full ${
                            player.is_connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                        }`}
                        title={player.is_connected ? 'Online' : 'Offline'}
                    />
                )}
            </div>

            {/* Video Modal */}
            <VideoModal
                show={showVideoModal}
                onClose={() => setShowVideoModal(false)}
                stream={modalStream ?? null}
                playerName={player.nickname}
                isMuted={modalIsMuted}
                isLocal={isCurrentUser}
            />
        </>
    );
}

// Icon components
function MicOnIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
    );
}

function MicOffIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
    );
}

function VideoOnIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    );
}

function VideoOffIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
        </svg>
    );
}

function MaximizeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
    );
}
