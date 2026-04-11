/**
 * Waiting-room phase for CubeTac online mode (light theme).
 *
 * Supports 2..6 players. The seat grid sizes from `room.game.max_players`
 * so the lobby always shows all possible slots, filled or empty.
 */

import { GamePlayer, GameRoom } from '@/types';
import { Link, router } from '@inertiajs/react';
import { useState, type CSSProperties } from 'react';
import { SLOT_CHARS } from './PlayingPhase';

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

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(room.room_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            // no-op
        }
    };

    return (
        <div className="flex h-full w-full flex-col overflow-auto px-4 py-6 sm:px-8">
            {/* Top bar */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleLeave}
                    className="inline-flex items-center gap-1.5 text-yellow-900 hover:text-yellow-700 font-bold transition text-sm"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-900/70">
                    Waiting Room
                </div>
                <span className="h-5 w-5" />
            </div>

            <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-6">
                <h2 className="text-3xl font-black text-yellow-900 drop-shadow-sm sm:text-4xl">
                    Share this code
                </h2>

                {/* Code card */}
                <button
                    type="button"
                    onClick={handleCopyCode}
                    className="group relative rounded-3xl bg-gradient-to-br from-white to-yellow-50 px-10 py-6 shadow-xl border-2 border-yellow-400 hover:border-yellow-500 hover:scale-[1.02] transition"
                >
                    <div className="text-5xl font-black tracking-[0.18em] text-yellow-900 sm:text-6xl">
                        {room.room_code}
                    </div>
                    <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-700 group-hover:text-yellow-800">
                        {copied ? '✓ Copied!' : 'Tap to copy'}
                    </div>
                </button>

                {/* Seats grid */}
                <div className="grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3 sm:gap-4">
                    {Array.from({ length: seatCount }, (_, slot) => {
                        const player = players[slot] ?? null;
                        return (
                            <SeatCard
                                key={slot}
                                slot={slot}
                                player={player}
                                isSelf={player !== null && currentPlayer?.id === player.id}
                            />
                        );
                    })}
                </div>

                {canStart ? (
                    <button
                        type="button"
                        onClick={handleStart}
                        className="mt-4 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 px-10 py-4 text-xl font-black text-white shadow-xl border-b-4 border-red-700 transition hover:scale-[1.03] hover:shadow-2xl"
                    >
                        Start Match
                    </button>
                ) : (
                    <div className="mt-4 rounded-full bg-white/80 px-6 py-3 text-xs font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md">
                        {isBelowMin
                            ? `Waiting for players… (${players.length} / ${min})`
                            : !isHost
                                ? 'Waiting for host to start…'
                                : `Ready (${players.length} / ${max})`}
                    </div>
                )}

                <Link
                    href={route('games.show', gameSlug)}
                    className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-900/40 hover:text-yellow-900/70 transition"
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
}

function SeatCard({ slot, player, isSelf }: SeatCardProps) {
    const char = SLOT_CHARS[slot] ?? '?';
    const color = player?.avatar_color ?? '#94a3b8';

    const filled = player !== null;
    const cardStyle: CSSProperties = filled
        ? {
              borderColor: color,
              boxShadow: `0 0 28px ${hexWithAlpha(color, 0.28)}`,
          }
        : {};

    return (
        <div
            className={`relative flex w-32 flex-col items-center gap-2 rounded-2xl border-2 bg-white px-3 py-4 sm:w-40 ${
                filled ? '' : 'border-gray-200'
            }`}
            style={cardStyle}
        >
            <div
                className="grid h-14 w-14 place-items-center rounded-full ring-4 ring-white shadow-md text-2xl font-black"
                style={{ backgroundColor: hexWithAlpha(color, 0.15), color }}
            >
                {char}
            </div>
            <span className="max-w-full truncate text-sm font-black text-gray-900">
                {player ? player.nickname : 'Empty'}
            </span>
            {isSelf && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-yellow-800">
                    you
                </span>
            )}
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
