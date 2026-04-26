import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVoiceChatOptional, VoicePlayer } from '@/Contexts/VoiceChatContext';
import VideoModal from '@/Components/VideoModal';

interface VoiceGalleryPanelProps {
    currentPlayerId: number;
}

const COLLAPSED_KEY = 'voiceGalleryCollapsed';
const POSITION_KEY = 'voiceGalleryPosition';
const SIZE_KEY = 'voiceGallerySize';

const DEFAULT_WIDTH = 224;
const DEFAULT_HEIGHT = 420;
const MIN_WIDTH = 180;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 720;
const EDGE_MARGIN = 8;

interface Point {
    x: number;
    y: number;
}

interface Size {
    w: number;
    h: number;
}

function readJson<T>(key: string): T | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const raw = window.localStorage.getItem(key);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export default function VoiceGalleryPanel({ currentPlayerId }: VoiceGalleryPanelProps) {
    const voiceChat = useVoiceChatOptional();
    const panelRef = useRef<HTMLDivElement>(null);

    const [collapsed, setCollapsed] = useState<boolean>(
        () => readJson<boolean>(COLLAPSED_KEY) === true
            || (typeof window !== 'undefined' && window.localStorage.getItem(COLLAPSED_KEY) === '1'),
    );
    const [position, setPosition] = useState<Point | null>(() => readJson<Point>(POSITION_KEY));
    const [size, setSize] = useState<Size | null>(() => readJson<Size>(SIZE_KEY));
    const [modalPlayerId, setModalPlayerId] = useState<number | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    }, [collapsed]);

    useEffect(() => {
        if (typeof window === 'undefined' || !position) {
            return;
        }
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    }, [position]);

    useEffect(() => {
        if (typeof window === 'undefined' || !size) {
            return;
        }
        window.localStorage.setItem(SIZE_KEY, JSON.stringify(size));
    }, [size]);

    const clampPositionToViewport = useCallback((pos: Point, w: number, h: number): Point => {
        if (typeof window === 'undefined') {
            return pos;
        }
        const maxX = Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
        const maxY = Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
        return {
            x: clamp(pos.x, EDGE_MARGIN, maxX),
            y: clamp(pos.y, EDGE_MARGIN, maxY),
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const handler = () => {
            if (!position || !panelRef.current) {
                return;
            }
            const rect = panelRef.current.getBoundingClientRect();
            const next = clampPositionToViewport(position, rect.width, rect.height);
            if (next.x !== position.x || next.y !== position.y) {
                setPosition(next);
            }
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, [position, clampPositionToViewport]);

    const dragStateRef = useRef<{
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        width: number;
        height: number;
        pointerId: number;
    } | null>(null);

    const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!panelRef.current) {
            return;
        }
        const target = e.target as HTMLElement;
        if (target.closest('button')) {
            return;
        }
        const rect = panelRef.current.getBoundingClientRect();
        dragStateRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: rect.left,
            origY: rect.top,
            width: rect.width,
            height: rect.height,
            pointerId: e.pointerId,
        };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        e.preventDefault();
    };

    const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== e.pointerId) {
            return;
        }
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const next = clampPositionToViewport(
            { x: drag.origX + dx, y: drag.origY + dy },
            drag.width,
            drag.height,
        );
        setPosition(next);
    };

    const handleHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== e.pointerId) {
            return;
        }
        try {
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        dragStateRef.current = null;
    };

    const resizeStateRef = useRef<{
        startX: number;
        startY: number;
        origW: number;
        origH: number;
        pointerId: number;
    } | null>(null);

    const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!panelRef.current) {
            return;
        }
        e.stopPropagation();
        e.preventDefault();
        const rect = panelRef.current.getBoundingClientRect();
        resizeStateRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origW: rect.width,
            origH: rect.height,
            pointerId: e.pointerId,
        };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const r = resizeStateRef.current;
        if (!r || r.pointerId !== e.pointerId) {
            return;
        }
        const dw = e.clientX - r.startX;
        const dh = e.clientY - r.startY;
        const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 2 * EDGE_MARGIN : 1000;
        const next: Size = {
            w: clamp(r.origW + dw, MIN_WIDTH, MAX_WIDTH),
            h: clamp(r.origH + dh, MIN_HEIGHT, maxHeight),
        };
        setSize(next);
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const r = resizeStateRef.current;
        if (!r || r.pointerId !== e.pointerId) {
            return;
        }
        try {
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        resizeStateRef.current = null;
    };

    // Once the panel mounts with a saved position, re-clamp against the actual rendered size
    // (the saved width/height may differ from the live one if the player count changed).
    useLayoutEffect(() => {
        if (!position || !panelRef.current) {
            return;
        }
        const rect = panelRef.current.getBoundingClientRect();
        const next = clampPositionToViewport(position, rect.width, rect.height);
        if (next.x !== position.x || next.y !== position.y) {
            setPosition(next);
        }
        // run once on mount; subsequent clamping handled by the resize listener
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!voiceChat || voiceChat.players.length === 0) {
        return null;
    }

    const orderedPlayers: VoicePlayer[] = [
        ...voiceChat.players.filter((p) => p.id === currentPlayerId),
        ...voiceChat.players.filter((p) => p.id !== currentPlayerId),
    ];

    const anyoneSpeaking = orderedPlayers.some((p) => voiceChat.speakingPlayers.has(p.id));

    const modalPlayer = modalPlayerId !== null ? orderedPlayers.find((p) => p.id === modalPlayerId) : null;
    const modalIsLocal = modalPlayerId === currentPlayerId;
    const modalStream = modalPlayer
        ? modalIsLocal
            ? voiceChat.localVideoStream
            : voiceChat.remoteVideos.get(modalPlayer.id) ?? null
        : null;
    const modalIsMuted = modalPlayer
        ? modalIsLocal
            ? voiceChat.isMuted
            : modalPlayer.is_muted
        : false;

    const positionStyle: React.CSSProperties = position
        ? { left: position.x, top: position.y }
        : { right: 16, top: '50%', transform: 'translateY(-50%)' };

    if (collapsed) {
        return (
            <div
                ref={panelRef}
                onPointerDown={handleHeaderPointerDown}
                onPointerMove={handleHeaderPointerMove}
                onPointerUp={handleHeaderPointerUp}
                onPointerCancel={handleHeaderPointerUp}
                style={positionStyle}
                className="fixed z-30 flex cursor-move touch-none flex-col items-center gap-2 rounded-l-xl rounded-r-md bg-gray-900/85 px-2 py-3 text-white shadow-xl backdrop-blur-sm"
                title="Drag to move • click chevron to expand"
            >
                <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white transition"
                    title="Show video panel"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="relative">
                    <VideoOnIcon className="h-5 w-5" />
                    <span className="absolute -top-2 -right-2 min-w-[18px] rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-[18px] text-white">
                        {voiceChat.players.length}
                    </span>
                </div>
                {anyoneSpeaking && (
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]" />
                )}
            </div>
        );
    }

    const sizeStyle: React.CSSProperties = size
        ? { width: size.w, height: size.h }
        : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

    return (
        <>
            <div
                ref={panelRef}
                style={{ ...positionStyle, ...sizeStyle, maxHeight: '90vh' }}
                className="fixed z-30 flex flex-col overflow-hidden rounded-2xl bg-gray-900/85 shadow-2xl backdrop-blur-sm"
            >
                <div
                    onPointerDown={handleHeaderPointerDown}
                    onPointerMove={handleHeaderPointerMove}
                    onPointerUp={handleHeaderPointerUp}
                    onPointerCancel={handleHeaderPointerUp}
                    className="flex shrink-0 cursor-move touch-none items-center justify-between border-b border-white/10 px-3 py-2 select-none"
                    title="Drag to move"
                >
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                        Voice ({voiceChat.players.length})
                    </span>
                    <button
                        type="button"
                        onClick={() => setCollapsed(true)}
                        className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white transition"
                        title="Hide video panel"
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                    {orderedPlayers.map((player) => (
                        <VoiceTile
                            key={player.id}
                            player={player}
                            isCurrentUser={player.id === currentPlayerId}
                            isSpeaking={voiceChat.speakingPlayers.has(player.id)}
                            remoteStream={voiceChat.remoteVideos.get(player.id) ?? null}
                            localStream={voiceChat.localVideoStream}
                            currentUserMuted={voiceChat.isMuted}
                            currentUserVideoOn={voiceChat.isVideoEnabled}
                            onToggleMute={voiceChat.toggleMute}
                            onToggleVideo={voiceChat.toggleVideo}
                            onMaximize={() => setModalPlayerId(player.id)}
                        />
                    ))}
                </div>

                <div
                    onPointerDown={handleResizePointerDown}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    onPointerCancel={handleResizePointerUp}
                    className="absolute bottom-1 right-1 flex h-8 w-8 cursor-se-resize touch-none items-center justify-center rounded-md bg-white/15 text-white/90 shadow-md backdrop-blur-sm transition hover:bg-white/30 hover:text-white"
                    title="Drag to resize"
                >
                    <ResizeGripIcon className="h-5 w-5" />
                </div>
            </div>

            <VideoModal
                show={modalPlayerId !== null && modalStream !== null}
                onClose={() => setModalPlayerId(null)}
                stream={modalStream}
                playerName={modalPlayer?.nickname ?? ''}
                isMuted={modalIsMuted}
                isLocal={modalIsLocal}
            />
        </>
    );
}

interface VoiceTileProps {
    player: VoicePlayer;
    isCurrentUser: boolean;
    isSpeaking: boolean;
    remoteStream: MediaStream | null;
    localStream: MediaStream | null;
    currentUserMuted: boolean;
    currentUserVideoOn: boolean;
    onToggleMute: () => Promise<void>;
    onToggleVideo: () => Promise<void>;
    onMaximize: () => void;
}

function VoiceTile({
    player,
    isCurrentUser,
    isSpeaking,
    remoteStream,
    localStream,
    currentUserMuted,
    currentUserVideoOn,
    onToggleMute,
    onToggleVideo,
    onMaximize,
}: VoiceTileProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    const isMuted = isCurrentUser ? currentUserMuted : player.is_muted;
    const hasVideoOn = isCurrentUser ? currentUserVideoOn : (player.is_video_enabled ?? false);
    const stream = isCurrentUser ? localStream : remoteStream;
    const showVideo = !!stream && (isCurrentUser ? currentUserVideoOn : true);

    useEffect(() => {
        if (videoRef.current && stream && showVideo) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, showVideo]);

    const tileClickable = !!stream;

    return (
        <div
            className={`relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-gray-800 ${
                tileClickable ? 'cursor-pointer' : ''
            }`}
            onClick={tileClickable ? onMaximize : undefined}
            title={tileClickable ? 'Click to maximize' : undefined}
        >
            {showVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full scale-x-[-1] object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center">
                    <div
                        className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md"
                        style={{ backgroundColor: player.avatar_color }}
                    >
                        {player.nickname.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}

            {isSpeaking && (
                <div className="pointer-events-none absolute inset-0 animate-pulse rounded-xl ring-4 ring-green-400 shadow-[0_0_18px_rgba(74,222,128,0.7)_inset]" />
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-2 pb-1 pt-3">
                <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-semibold text-white">
                        {player.nickname}
                        {isCurrentUser && <span className="ml-1 text-blue-300">(You)</span>}
                    </span>
                    <div className="flex items-center gap-1">
                        {hasVideoOn && !isCurrentUser && (
                            <VideoOnIcon className="h-3.5 w-3.5 text-blue-300" />
                        )}
                        {isMuted ? (
                            <MicOffIcon className="h-3.5 w-3.5 text-red-400" />
                        ) : (
                            <MicOnIcon className="h-3.5 w-3.5 text-green-400" />
                        )}
                    </div>
                </div>
            </div>

            {isCurrentUser && (
                <div className="absolute right-1 top-1 flex gap-1">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            void onToggleMute();
                        }}
                        className={`rounded-full p-1.5 text-white shadow transition hover:scale-110 ${
                            isMuted ? 'bg-red-500/90' : 'bg-green-500/90'
                        }`}
                        title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                        {isMuted ? (
                            <MicOffIcon className="h-3.5 w-3.5" />
                        ) : (
                            <MicOnIcon className="h-3.5 w-3.5" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            void onToggleVideo();
                        }}
                        className={`rounded-full p-1.5 text-white shadow transition hover:scale-110 ${
                            hasVideoOn ? 'bg-green-500/90' : 'bg-gray-600/90'
                        }`}
                        title={hasVideoOn ? 'Turn off camera' : 'Turn on camera'}
                    >
                        {hasVideoOn ? (
                            <VideoOnIcon className="h-3.5 w-3.5" />
                        ) : (
                            <VideoOffIcon className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

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

function ChevronLeftIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
    );
}

function ChevronRightIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
    );
}

function ResizeGripIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15L15 21M21 9L9 21" />
        </svg>
    );
}
