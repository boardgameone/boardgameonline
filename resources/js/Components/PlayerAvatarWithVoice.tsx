import { useVoiceChatOptional } from '@/Contexts/VoiceChatContext';
import VideoModal from '@/Components/VideoModal';
import { useEffect, useRef, useState, ReactNode } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

interface PlayerAvatarWithVoiceProps {
    playerId: number;
    nickname: string;
    avatarColor: string;
    currentPlayerId: number;
    size?: AvatarSize;
    showVoiceControls?: boolean;
    showVoiceIndicators?: boolean;
    avatarClassName?: string;
    children?: ReactNode;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; icon: string; dot: string }> = {
    xs: { container: 'h-6 w-6', text: 'text-xs', icon: 'h-3 w-3', dot: 'h-2 w-2' },
    sm: { container: 'h-8 w-8', text: 'text-sm', icon: 'h-3 w-3', dot: 'h-2 w-2' },
    md: { container: 'h-12 w-12', text: 'text-lg', icon: 'h-4 w-4', dot: 'h-2.5 w-2.5' },
    lg: { container: 'h-14 w-14', text: 'text-xl', icon: 'h-5 w-5', dot: 'h-3 w-3' },
};

export default function PlayerAvatarWithVoice({
    playerId,
    nickname,
    avatarColor,
    currentPlayerId,
    size = 'md',
    showVoiceControls = false,
    showVoiceIndicators = true,
    avatarClassName = '',
    children,
}: PlayerAvatarWithVoiceProps) {
    const voiceChat = useVoiceChatOptional();
    const videoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [showVideoModal, setShowVideoModal] = useState(false);

    const isCurrentUser = playerId === currentPlayerId;
    const sizes = sizeClasses[size];

    // Get voice state from context if available
    const isSpeaking = voiceChat?.speakingPlayers.has(playerId) ?? false;
    const remoteVideoStream = voiceChat?.remoteVideos.get(playerId);
    const localVideoStream = voiceChat?.localVideoStream;

    // Get voice player data from context
    const voicePlayer = voiceChat?.players.find(p => p.id === playerId);
    const playerIsMuted = voicePlayer?.is_muted ?? true;
    const playerHasVideo = voicePlayer?.is_video_enabled ?? false;

    // For current user, use context state directly
    const currentUserIsMuted = isCurrentUser ? (voiceChat?.isMuted ?? true) : playerIsMuted;
    const currentUserHasVideo = isCurrentUser ? (voiceChat?.isVideoEnabled ?? false) : playerHasVideo;

    // Show video when we have a video stream (don't wait for backend flag - WebRTC is real-time)
    const showRemoteVideo = !isCurrentUser && remoteVideoStream;
    const showLocalVideo = isCurrentUser && localVideoStream && currentUserHasVideo;
    const hasVideo = showRemoteVideo || showLocalVideo;

    const canShowVoiceFeatures = showVoiceIndicators && voiceChat?.isConnected;
    const canShowVoiceControls = showVoiceControls && voiceChat?.isConnected;

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

    const handleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasVideo) {
            setShowVideoModal(true);
        }
    };

    // Determine stream and mute state for the modal
    const modalStream = isCurrentUser ? localVideoStream : remoteVideoStream;
    const modalIsMuted = isCurrentUser ? currentUserIsMuted : playerIsMuted;

    return (
        <>
            <div className="flex flex-col items-center gap-1">
                {/* Avatar / Video Area */}
                <div
                    className={`relative ${sizes.container} flex-shrink-0 ${
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
                                className={`absolute inset-0 object-cover rounded-full scale-x-[-1] ${sizes.container} ${avatarClassName}`}
                            />
                            {/* Maximize overlay on hover */}
                            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <MaximizeIcon className={sizes.icon} />
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
                                className={`absolute inset-0 object-cover rounded-full scale-x-[-1] ${sizes.container} ${avatarClassName}`}
                            />
                            {/* Maximize overlay on hover */}
                            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <MaximizeIcon className={sizes.icon} />
                            </div>
                        </>
                    )}

                    {/* Avatar (shown when no video) */}
                    {!showRemoteVideo && !showLocalVideo && (
                        <div
                            className={`flex items-center justify-center rounded-full text-white font-bold shadow-md ${sizes.container} ${sizes.text} ${
                                isSpeaking && canShowVoiceFeatures ? 'animate-pulse' : ''
                            } ${avatarClassName}`}
                            style={{ backgroundColor: avatarColor }}
                        >
                            {nickname.charAt(0).toUpperCase()}
                        </div>
                    )}

                    {/* Speaking indicator dot */}
                    {isSpeaking && canShowVoiceFeatures && (
                        <span className={`absolute -bottom-0.5 -right-0.5 ${sizes.dot} bg-green-500 rounded-full border-2 border-white`} />
                    )}

                    {/* Children overlay (for game-specific badges) */}
                    {children}
                </div>

                {/* Voice/Video Controls (for current user only) */}
                {canShowVoiceControls && isCurrentUser && (
                    <div className="flex items-center gap-1 mt-1">
                        <button
                            onClick={handleToggleMute}
                            className={`p-1 rounded-full transition hover:scale-110 ${
                                currentUserIsMuted
                                    ? 'bg-red-500 text-white'
                                    : 'bg-green-500 text-white'
                            }`}
                            title={currentUserIsMuted ? 'Unmute microphone' : 'Mute microphone'}
                        >
                            {currentUserIsMuted ? (
                                <MicOffIcon className={sizes.icon} />
                            ) : (
                                <MicOnIcon className={sizes.icon} />
                            )}
                        </button>
                        <button
                            onClick={handleToggleVideo}
                            className={`p-1 rounded-full transition hover:scale-110 ${
                                currentUserHasVideo
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-600 text-white'
                            }`}
                            title={currentUserHasVideo ? 'Turn off camera' : 'Turn on camera'}
                        >
                            {currentUserHasVideo ? (
                                <VideoOnIcon className={sizes.icon} />
                            ) : (
                                <VideoOffIcon className={sizes.icon} />
                            )}
                        </button>
                    </div>
                )}

                {/* Voice status indicators (for other players) */}
                {canShowVoiceFeatures && !isCurrentUser && (
                    <div className="flex items-center gap-1 mt-1">
                        {playerHasVideo && (
                            <span className="text-blue-500" title="Video enabled">
                                <VideoOnIcon className={sizes.icon} />
                            </span>
                        )}
                        <span
                            className={playerIsMuted ? 'text-red-400' : 'text-green-500'}
                            title={playerIsMuted ? 'Muted' : 'Unmuted'}
                        >
                            {playerIsMuted ? (
                                <MicOffIcon className={sizes.icon} />
                            ) : (
                                <MicOnIcon className={sizes.icon} />
                            )}
                        </span>
                    </div>
                )}
            </div>

            {/* Video Modal */}
            <VideoModal
                show={showVideoModal}
                onClose={() => setShowVideoModal(false)}
                stream={modalStream ?? null}
                playerName={nickname}
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
        <svg className={`${className} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
    );
}
