/**
 * Waiting-room phase for CubeTac online mode (light theme).
 *
 * Supports 2..6 players. The seat grid sizes from `room.game.max_players`
 * so the lobby always shows all possible slots, filled or empty.
 */

import { GamePlayer, GameRoom } from '@/types';
import { Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SLOT_CHARS } from './PlayingPhase';
import { useVoiceChatOptional } from '@/Contexts/VoiceChatContext';
import VideoModal from '@/Components/VideoModal';

/** Mirrors SLOT_COLORS in CubeTacGameController.php (design index → hex). */
const DESIGN_COLORS = ['#ff4d2e', '#3a90ff', '#16a34a', '#a855f7', '#f59e0b', '#c2813a'];

/** Human-readable names for the design-picker's aria-labels / tooltips. */
const DESIGN_NAMES = ['X', 'Circle', 'Triangle', 'Square', 'Plus', 'Hexagon'];

function designFor(player: GamePlayer | null, fallback: number): number {
    const raw = player?.game_data?.['cubetac_design'];
    return typeof raw === 'number' && raw >= 0 && raw <= 5 ? raw : fallback;
}

interface WaitingPhaseProps {
    room: GameRoom;
    currentPlayer: GamePlayer | null;
    players: GamePlayer[];
    isHost: boolean;
    gameSlug: string;
}

export default function WaitingPhase({ room, currentPlayer, players, isHost, gameSlug }: WaitingPhaseProps) {
    const min = room.game?.min_players ?? 2;
    const max = room.game?.max_players ?? 6;
    const seatCount = Math.max(max, players.length);
    const canStart = isHost && players.length >= min && players.length <= max;
    const isBelowMin = players.length < min;
    const [copied, setCopied] = useState(false);

    const handleStart = () => {
        router.post(route('rooms.cubetac.start', [gameSlug, room.room_code]));
    };

    const handleLeave = () => {
        router.post(route('rooms.leave', [gameSlug, room.room_code]));
    };

    const handleKick = (player: GamePlayer) => {
        if (!window.confirm(`Kick ${player.nickname}?`)) {
            return;
        }
        router.post(
            route('rooms.kick', [gameSlug, room.room_code]),
            { player_id: player.id },
            { preserveScroll: true },
        );
    };

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(room.room_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            // no-op
        }
    };

    const handlePickDesign = (design: number) => {
        router.post(
            route('rooms.cubetac.pickDesign', [gameSlug, room.room_code]),
            { design },
            { preserveScroll: true, preserveState: true },
        );
    };

    const variant: 'cube' | 'megaminx' = room.variant === 'megaminx' ? 'megaminx' : 'cube';

    const handlePickVariant = (next: 'cube' | 'megaminx') => {
        if (next === variant) return;
        router.post(
            route('rooms.pickVariant', [gameSlug, room.room_code]),
            { variant: next },
            { preserveScroll: true, preserveState: true },
        );
    };

    // Map of design-index → holder player id, so the picker can dim
    // swatches taken by other players. Includes disconnected holders so a
    // reconnect keeps their glyph intact.
    const designOwners = useMemo(() => {
        const owners = new Map<number, number>();
        for (const p of players) {
            const d = designFor(p, -1);
            if (d >= 0) {
                owners.set(d, p.id);
            }
        }
        return owners;
    }, [players]);

    return (
        <div className="flex h-full w-full flex-col overflow-auto px-4 py-6 sm:px-8">
            {/* Top bar */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleLeave}
                    className="inline-flex items-center gap-1.5 text-yellow-900 hover:text-yellow-700 font-bold transition text-sm dark:text-yellow-300 dark:hover:text-yellow-200"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-900/70 dark:text-yellow-300/70">
                    Waiting Room
                </div>
                <span className="h-5 w-5" />
            </div>

            <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-6">
                <h2 className="text-3xl font-black text-yellow-900 drop-shadow-xs sm:text-4xl dark:text-yellow-300">
                    Share this code
                </h2>

                {/* Code card */}
                <button
                    type="button"
                    onClick={handleCopyCode}
                    className="group relative rounded-3xl bg-linear-to-br from-white to-yellow-50 px-10 py-6 shadow-xl border-2 border-yellow-400 hover:border-yellow-500 hover:scale-[1.02] transition dark:from-gray-800 dark:to-gray-900 dark:border-yellow-600/60 dark:hover:border-yellow-500/80"
                >
                    <div className="text-5xl font-black tracking-[0.18em] text-yellow-900 sm:text-6xl dark:text-yellow-300">
                        {room.room_code}
                    </div>
                    <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-700 group-hover:text-yellow-800 dark:text-yellow-400 dark:group-hover:text-yellow-300">
                        {copied ? '✓ Copied!' : 'Tap to copy'}
                    </div>
                </button>

                {/* Seats grid */}
                <div className="grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3 sm:gap-4">
                    {Array.from({ length: seatCount }, (_, slot) => {
                        const player = players[slot] ?? null;
                        const isSelf = player !== null && currentPlayer?.id === player.id;
                        const canKick = isHost && player !== null && !isSelf && !player.is_host;
                        return (
                            <SeatCard
                                key={slot}
                                slot={slot}
                                player={player}
                                isSelf={isSelf}
                                onKick={canKick ? () => handleKick(player!) : undefined}
                                designOwners={designOwners}
                                onPickDesign={isSelf ? handlePickDesign : undefined}
                            />
                        );
                    })}
                </div>

                {/* Variant picker — host chooses the playing surface; locked once the match starts. */}
                <div className="mt-2 flex flex-col items-center gap-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-900/70 dark:text-yellow-300/70">
                        Playing surface
                    </div>
                    <div className="inline-flex rounded-full border-2 border-yellow-400 bg-white/80 p-1 shadow-md dark:bg-gray-800/80 dark:border-yellow-600/60">
                        {(['cube', 'megaminx'] as const).map((v) => {
                            const selected = v === variant;
                            const label = v === 'cube' ? 'Cube · 6 faces' : 'Megaminx · 12 faces';
                            return (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={isHost ? () => handlePickVariant(v) : undefined}
                                    disabled={!isHost}
                                    aria-pressed={selected}
                                    className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] transition ${
                                        selected
                                            ? 'bg-linear-to-r from-orange-500 to-pink-500 text-white shadow-md'
                                            : 'text-yellow-900 hover:bg-yellow-100/70 dark:text-yellow-300 dark:hover:bg-yellow-900/30'
                                    } ${!isHost ? 'cursor-not-allowed opacity-70' : ''}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {!isHost && (
                        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-900/50 dark:text-yellow-300/50">
                            Host picks the variant
                        </div>
                    )}
                </div>

                {canStart ? (
                    <button
                        type="button"
                        onClick={handleStart}
                        className="mt-4 rounded-full bg-linear-to-r from-orange-500 via-red-500 to-pink-600 px-10 py-4 text-xl font-black text-white shadow-xl border-b-4 border-red-700 transition hover:scale-[1.03] hover:shadow-2xl"
                    >
                        Start Match
                    </button>
                ) : (
                    <div className="mt-4 rounded-full bg-white/80 px-6 py-3 text-xs font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md dark:bg-gray-800/80 dark:text-gray-300">
                        {isBelowMin
                            ? `Waiting for players… (${players.length} / ${min})`
                            : !isHost
                                ? 'Waiting for host to start…'
                                : `Ready (${players.length} / ${max})`}
                    </div>
                )}

                <Link
                    href={route('games.show', gameSlug)}
                    className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-900/40 hover:text-yellow-900/70 transition dark:text-yellow-300/40 dark:hover:text-yellow-300/70"
                >
                    ← back to main menu
                </Link>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------

interface SeatCardProps {
    slot: number;
    player: GamePlayer | null;
    isSelf: boolean;
    onKick?: () => void;
    /** design-index → holder player-id, for dimming swatches taken by others. */
    designOwners: Map<number, number>;
    /** Defined only for the viewer's own seat. Posts the pick to the server. */
    onPickDesign?: (design: number) => void;
}

function SeatCard({ slot, player, isSelf, onKick, designOwners, onPickDesign }: SeatCardProps) {
    // Only filled seats render the player's chosen glyph; empty seats show a
    // neutral "?" so an empty slot doesn't look like it's already been claimed.
    const design = designFor(player, slot);
    const char = player ? SLOT_CHARS[design] ?? '?' : '?';
    const color = player?.avatar_color ?? '#94a3b8';

    const voiceChat = useVoiceChatOptional();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [showModal, setShowModal] = useState(false);

    const filled = player !== null;
    const voiceReady = !!voiceChat?.isConnected && filled;

    const remoteStream = filled && !isSelf ? voiceChat?.remoteVideos.get(player!.id) ?? null : null;
    const localStream = isSelf && voiceChat?.isVideoEnabled ? voiceChat.localVideoStream ?? null : null;
    const videoStream = remoteStream ?? localStream;
    const hasVideo = !!videoStream;

    const isSpeaking = filled && voiceReady && voiceChat!.speakingPlayers.has(player!.id);

    const peerVoice = filled ? voiceChat?.players.find((p) => p.id === player!.id) : undefined;
    const selfMuted = voiceChat?.isMuted ?? true;
    const selfVideoOn = voiceChat?.isVideoEnabled ?? false;
    const otherMuted = peerVoice?.is_muted ?? true;
    const otherVideoOn = peerVoice?.is_video_enabled ?? false;

    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    const cardStyle: CSSProperties = filled
        ? {
              borderColor: color,
              boxShadow: `0 0 28px ${hexWithAlpha(color, 0.28)}`,
          }
        : {};

    const handleAvatarClick = () => {
        if (hasVideo) {
            setShowModal(true);
        }
    };

    const handleToggleMute = async () => {
        if (voiceChat && isSelf) {
            await voiceChat.toggleMute();
        }
    };

    const handleToggleVideo = async () => {
        if (voiceChat && isSelf) {
            await voiceChat.toggleVideo();
        }
    };

    return (
        <>
            <div
                className={`relative flex w-32 flex-col items-center gap-2 rounded-2xl border-2 bg-white px-3 py-4 sm:w-40 dark:bg-gray-800 ${
                    filled ? '' : 'border-gray-200 dark:border-gray-700'
                } ${isSpeaking ? 'ring-2 ring-green-400' : ''}`}
                style={cardStyle}
            >
                {onKick && (
                    <button
                        type="button"
                        onClick={onKick}
                        aria-label={`Kick ${player?.nickname ?? 'player'}`}
                        title="Kick player"
                        className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-white text-red-600 shadow-md border-2 border-red-400 hover:bg-red-500 hover:text-white hover:scale-110 transition dark:bg-gray-900 dark:border-red-500/70 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                {filled && player!.wins > 0 && (
                    <span
                        title={`${player!.wins} ${player!.wins === 1 ? 'win' : 'wins'} this lobby`}
                        className="absolute -top-2 -left-2 inline-flex h-7 min-w-[1.75rem] items-center justify-center gap-0.5 rounded-full bg-yellow-300 px-2 text-xs font-black text-yellow-900 shadow-md border-2 border-yellow-500 dark:bg-yellow-400 dark:border-yellow-600 dark:text-yellow-950"
                    >
                        <span aria-hidden="true">🏆</span>
                        {player!.wins}
                    </span>
                )}
                <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={!hasVideo}
                    title={hasVideo ? 'Click to maximize' : undefined}
                    className={`relative grid h-14 w-14 place-items-center overflow-hidden rounded-full ring-4 ring-white shadow-md text-2xl font-black dark:ring-gray-800 ${
                        hasVideo ? 'cursor-pointer group' : 'cursor-default'
                    } ${isSpeaking ? 'animate-pulse' : ''}`}
                    style={
                        hasVideo
                            ? { backgroundColor: '#000' }
                            : { backgroundColor: hexWithAlpha(color, 0.15), color }
                    }
                >
                    {hasVideo ? (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </span>
                        </>
                    ) : (
                        <span>{char}</span>
                    )}
                </button>
                <span className="max-w-full truncate text-sm font-black text-gray-900 dark:text-gray-100">
                    {player ? player.nickname : 'Empty'}
                </span>
                {isSelf && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                        you
                    </span>
                )}

                {/* Voice controls / status */}
                {voiceReady && isSelf && (
                    <div className="flex items-center gap-1.5 pt-1">
                        <button
                            type="button"
                            onClick={handleToggleMute}
                            aria-label={selfMuted ? 'Unmute microphone' : 'Mute microphone'}
                            title={selfMuted ? 'Unmute microphone' : 'Mute microphone'}
                            className={`grid h-7 w-7 place-items-center rounded-full text-white shadow-md transition hover:scale-110 ${
                                selfMuted ? 'bg-red-500' : 'bg-green-500'
                            }`}
                        >
                            {selfMuted ? <MicOffIcon className="h-3.5 w-3.5" /> : <MicOnIcon className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleVideo}
                            aria-label={selfVideoOn ? 'Turn off camera' : 'Turn on camera'}
                            title={selfVideoOn ? 'Turn off camera' : 'Turn on camera'}
                            className={`grid h-7 w-7 place-items-center rounded-full text-white shadow-md transition hover:scale-110 ${
                                selfVideoOn ? 'bg-green-500' : 'bg-gray-500'
                            }`}
                        >
                            {selfVideoOn ? (
                                <VideoOnIcon className="h-3.5 w-3.5" />
                            ) : (
                                <VideoOffIcon className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </div>
                )}
                {voiceReady && !isSelf && (
                    <div className="flex items-center gap-1.5 pt-1 text-gray-500 dark:text-gray-400">
                        {otherVideoOn && (
                            <span className="text-blue-500 dark:text-blue-400" title="Video on">
                                <VideoOnIcon className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <span
                            className={otherMuted ? 'text-red-400' : 'text-green-500'}
                            title={otherMuted ? 'Muted' : 'Unmuted'}
                        >
                            {otherMuted ? (
                                <MicOffIcon className="h-3.5 w-3.5" />
                            ) : (
                                <MicOnIcon className="h-3.5 w-3.5" />
                            )}
                        </span>
                    </div>
                )}

                {isSelf && onPickDesign && (
                    <DesignPicker
                        currentDesign={design}
                        designOwners={designOwners}
                        selfPlayerId={player!.id}
                        onPick={onPickDesign}
                    />
                )}
            </div>

            {filled && (
                <VideoModal
                    show={showModal}
                    onClose={() => setShowModal(false)}
                    stream={videoStream}
                    playerName={player!.nickname}
                    isMuted={isSelf ? selfMuted : otherMuted}
                    isLocal={isSelf}
                />
            )}
        </>
    );
}

interface DesignPickerProps {
    currentDesign: number;
    designOwners: Map<number, number>;
    selfPlayerId: number;
    onPick: (design: number) => void;
}

function DesignPicker({ currentDesign, designOwners, selfPlayerId, onPick }: DesignPickerProps) {
    return (
        <div
            className="mt-1 grid w-full grid-cols-6 place-items-center gap-0.5"
            role="radiogroup"
            aria-label="Choose your design"
        >
            {SLOT_CHARS.map((char, design) => {
                const owner = designOwners.get(design);
                const takenByOther = owner !== undefined && owner !== selfPlayerId;
                const isCurrent = design === currentDesign;
                const color = DESIGN_COLORS[design] ?? '#94a3b8';
                return (
                    <button
                        key={design}
                        type="button"
                        role="radio"
                        aria-checked={isCurrent}
                        aria-label={DESIGN_NAMES[design]}
                        title={takenByOther ? `${DESIGN_NAMES[design]} — taken` : DESIGN_NAMES[design]}
                        disabled={takenByOther}
                        onClick={() => {
                            if (!isCurrent && !takenByOther) {
                                onPick(design);
                            }
                        }}
                        className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-black leading-none transition ${
                            isCurrent ? 'scale-110 shadow-sm' : 'hover:scale-110'
                        } ${takenByOther ? 'opacity-30 cursor-not-allowed' : ''}`}
                        style={{
                            backgroundColor: isCurrent ? color : hexWithAlpha(color, 0.15),
                            color: isCurrent ? '#fff' : color,
                        }}
                    >
                        {char}
                    </button>
                );
            })}
        </div>
    );
}

function hexWithAlpha(hex: string, alpha: number): string {
    let h = hex.replace('#', '');
    if (h.length === 3) {
        h = h.split('').map((c) => c + c).join('');
    }
    if (h.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
