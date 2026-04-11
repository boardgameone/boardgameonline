/**
 * Waiting-room phase for CubeTac online mode (light theme).
 */

import { GamePlayer, GameRoom } from '@/types';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface WaitingPhaseProps {
    room: GameRoom;
    currentPlayer: GamePlayer | null;
    players: GamePlayer[];
    isHost: boolean;
    gameSlug: string;
}

export default function WaitingPhase({ room, currentPlayer, players, isHost, gameSlug }: WaitingPhaseProps) {
    const [xPlayer, oPlayer] = [players[0] ?? null, players[1] ?? null];
    const canStart = isHost && players.length === 2;
    const isMissingPlayer = players.length < 2;
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

                {/* Seats */}
                <div className="flex items-center gap-4 sm:gap-6">
                    <SeatCard
                        symbol="X"
                        player={xPlayer}
                        isSelf={currentPlayer?.id === xPlayer?.id}
                    />
                    <span className="text-2xl font-black text-yellow-900/50 sm:text-3xl">vs</span>
                    <SeatCard
                        symbol="O"
                        player={oPlayer}
                        isSelf={currentPlayer?.id === oPlayer?.id}
                    />
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
                        {isMissingPlayer
                            ? 'Waiting for opponent…'
                            : !isHost
                                ? 'Waiting for host to start…'
                                : 'Ready'}
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
    symbol: 'X' | 'O';
    player: GamePlayer | null;
    isSelf: boolean;
}

function SeatCard({ symbol, player, isSelf }: SeatCardProps) {
    // Literal class name strings so Tailwind's scanner detects them
    const symbolColor = symbol === 'X' ? 'text-red-500' : 'text-blue-600';
    const bgTint = symbol === 'X' ? 'bg-red-50' : 'bg-blue-50';
    const borderClass = symbol === 'X' ? 'border-red-300' : 'border-blue-300';
    const shadowClass = symbol === 'X'
        ? 'shadow-[0_0_28px_rgba(239,68,68,0.25)]'
        : 'shadow-[0_0_28px_rgba(37,99,235,0.25)]';

    return (
        <div
            className={`relative flex w-36 flex-col items-center gap-2 rounded-2xl border-2 bg-white px-4 py-5 sm:w-44 ${
                player ? `${borderClass} ${shadowClass}` : 'border-gray-200'
            }`}
        >
            <div className={`grid h-16 w-16 place-items-center rounded-full ${bgTint} ring-4 ring-white shadow-md ${symbolColor}`}>
                <span className="text-3xl font-black">{symbol}</span>
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
