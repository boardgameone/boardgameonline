import StackedTrio from './StackedTrio';
import GameIcon from '@/Components/GameIcon';
import VideoModal from '@/Components/VideoModal';
import { useVoiceChatOptional } from '@/Contexts/VoiceChatContext';
import { useEffect, useRef, useState } from 'react';

interface Player {
    id: number;
    nickname: string;
    avatar_color: string;
    hand_count: number;
    collected_trios: number[][];
    trios_count: number;
    is_current_turn: boolean;
}

interface PlayerStatsProps {
    players: Player[];
    currentPlayerId?: number;
    canReveal: boolean;
    onAskHighest: (playerId: number) => void;
    onAskLowest: (playerId: number) => void;
    compact?: boolean;
}

export default function PlayerStats({
    players,
    currentPlayerId,
    canReveal,
    onAskHighest,
    onAskLowest,
    compact = false,
}: PlayerStatsProps) {
    const voiceChat = useVoiceChatOptional();

    return (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
            {players.map((player, index) => (
                <PlayerStatsCard
                    key={player.id}
                    player={player}
                    index={index}
                    currentPlayerId={currentPlayerId}
                    canReveal={canReveal}
                    onAskHighest={onAskHighest}
                    onAskLowest={onAskLowest}
                    compact={compact}
                    voiceChat={voiceChat}
                />
            ))}
        </div>
    );
}

interface PlayerStatsCardProps {
    player: Player;
    index: number;
    currentPlayerId?: number;
    canReveal: boolean;
    onAskHighest: (playerId: number) => void;
    onAskLowest: (playerId: number) => void;
    compact: boolean;
    voiceChat: ReturnType<typeof useVoiceChatOptional>;
}

function PlayerStatsCard({
    player,
    index,
    currentPlayerId,
    canReveal,
    onAskHighest,
    onAskLowest,
    compact,
    voiceChat,
}: PlayerStatsCardProps) {
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
    const playerIsMuted = voicePlayer?.is_muted ?? true;
    const playerHasVideo = voicePlayer?.is_video_enabled ?? false;

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

    const canShowVoiceControls = voiceChat?.isConnected;

    // Determine stream and mute state for the modal
    const modalStream = isCurrentUser ? localVideoStream : remoteVideoStream;
    const modalIsMuted = isCurrentUser ? currentUserIsMuted : playerIsMuted;

    return (
        <>
            <div
                className={`rounded-lg border-2 transition-all duration-300 animate-slideIn ${
                    compact ? 'p-2' : 'p-4 rounded-xl'
                } ${
                    player.is_current_turn
                        ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-100 shadow-lg'
                        : 'border-gray-200 bg-white'
                } ${
                    isSpeaking && canShowVoiceControls ? 'ring-2 ring-green-400' : ''
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
            >
                <div className={`flex items-center justify-between ${compact ? '' : 'mb-2'}`}>
                    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
                        {/* Avatar / Video Area */}
                        <div
                            className={`relative ${compact ? 'h-8 w-8' : 'h-12 w-12'} flex-shrink-0 ${
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
                                            compact ? 'h-8 w-8' : 'h-12 w-12'
                                        } ${
                                            player.is_current_turn ? (compact ? 'ring-2 ring-yellow-400' : 'ring-4 ring-yellow-400 ring-offset-2') : ''
                                        }`}
                                    />
                                    {/* Maximize overlay on hover */}
                                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <MaximizeIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
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
                                            compact ? 'h-8 w-8' : 'h-12 w-12'
                                        } ${
                                            player.is_current_turn ? (compact ? 'ring-2 ring-yellow-400' : 'ring-4 ring-yellow-400 ring-offset-2') : ''
                                        }`}
                                    />
                                    {/* Maximize overlay on hover */}
                                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <MaximizeIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                    </div>
                                </>
                            )}

                            {/* Avatar (shown when no video) */}
                            {!showRemoteVideo && !showLocalVideo && (
                                <div
                                    className={`rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                                        compact ? 'h-8 w-8 text-sm' : 'h-12 w-12 text-lg'
                                    } ${
                                        player.is_current_turn ? (compact ? 'ring-2 ring-yellow-400' : 'ring-4 ring-yellow-400 ring-offset-2') : ''
                                    } ${isSpeaking && canShowVoiceControls ? 'animate-pulse' : ''}`}
                                    style={{ backgroundColor: player.avatar_color }}
                                >
                                    {player.nickname.charAt(0).toUpperCase()}
                                </div>
                            )}

                            {/* Speaking indicator dot */}
                            {isSpeaking && canShowVoiceControls && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white" />
                            )}
                        </div>

                        {/* Player info */}
                        <div>
                            <p className={`font-bold text-gray-900 flex items-center gap-1 ${compact ? 'text-sm' : ''}`}>
                                <span className={compact ? 'truncate max-w-[80px]' : ''}>{player.nickname}</span>
                                {player.id === currentPlayerId && (
                                    <span className={`bg-blue-100 text-blue-700 rounded-full font-semibold ${
                                        compact ? 'text-[10px] px-1' : 'text-xs px-2 py-0.5'
                                    }`}>
                                        You
                                    </span>
                                )}
                                {player.is_current_turn && (
                                    <span className={`bg-yellow-100 text-yellow-700 rounded-full font-semibold ${
                                        compact ? 'text-[10px] px-1' : 'text-xs px-2 py-0.5'
                                    }`}>
                                        Turn
                                    </span>
                                )}
                            </p>
                            <div className={`flex items-center gap-2 text-gray-600 ${compact ? 'text-xs' : 'text-sm mt-1'}`}>
                                <span className="flex items-center gap-1">
                                    <span className="font-semibold">{player.hand_count}</span>{compact ? '' : ' cards'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <GameIcon name="trophy" size="sm" className="text-yellow-500" /> <span className="font-semibold">{player.trios_count}</span>
                                </span>
                                {/* Voice/Video status indicators */}
                                {canShowVoiceControls && (
                                    <>
                                        {playerHasVideo && !isCurrentUser && (
                                            <span className="text-blue-500" title="Video enabled">
                                                <VideoOnIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                            </span>
                                        )}
                                        {!isCurrentUser && (
                                            <span
                                                className={playerIsMuted ? 'text-red-400' : 'text-green-500'}
                                                title={playerIsMuted ? 'Muted' : 'Unmuted'}
                                            >
                                                {playerIsMuted ? (
                                                    <MicOffIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                                ) : (
                                                    <MicOnIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                                )}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Controls area */}
                    <div className="flex items-center gap-2">
                        {/* Voice controls for current user */}
                        {canShowVoiceControls && isCurrentUser && (
                            <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
                                <button
                                    onClick={handleToggleMute}
                                    className={`rounded-full transition hover:scale-110 ${
                                        compact ? 'p-1' : 'p-1.5'
                                    } ${
                                        voiceChat?.isMuted
                                            ? 'bg-red-500 text-white'
                                            : 'bg-green-500 text-white'
                                    }`}
                                    title={voiceChat?.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                                >
                                    {voiceChat?.isMuted ? (
                                        <MicOffIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                    ) : (
                                        <MicOnIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                    )}
                                </button>
                                <button
                                    onClick={handleToggleVideo}
                                    className={`rounded-full transition hover:scale-110 ${
                                        compact ? 'p-1' : 'p-1.5'
                                    } ${
                                        voiceChat?.isVideoEnabled
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-600 text-white'
                                    }`}
                                    title={voiceChat?.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                                >
                                    {voiceChat?.isVideoEnabled ? (
                                        <VideoOnIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                    ) : (
                                        <VideoOffIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Ask buttons */}
                        {canReveal && player.hand_count > 0 && (
                            <div className={`flex ${compact ? 'gap-1' : 'gap-2'}`}>
                                <button
                                    onClick={() => onAskHighest(player.id)}
                                    className={`rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 font-bold text-white shadow hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 ${
                                        compact ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
                                    }`}
                                >
                                    {compact ? 'H' : 'High'}
                                </button>
                                <button
                                    onClick={() => onAskLowest(player.id)}
                                    className={`rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 font-bold text-white shadow hover:from-purple-600 hover:to-purple-700 transition-all duration-200 hover:scale-105 active:scale-95 ${
                                        compact ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
                                    }`}
                                >
                                    {compact ? 'L' : 'Low'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collected trios - show inline in compact mode */}
                {player.collected_trios.length > 0 && (
                    <div className={compact ? 'mt-2 pt-2 border-t border-gray-200' : 'mt-3 pt-3 border-t border-gray-200'}>
                        <div className={`flex gap-2 flex-wrap ${compact ? '' : 'gap-4'}`}>
                            {player.collected_trios.map((trio, idx) => (
                                <StackedTrio
                                    key={idx}
                                    cards={trio}
                                    size="xs"
                                />
                            ))}
                        </div>
                    </div>
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
