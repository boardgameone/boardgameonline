/**
 * Game-over phase: reveal + rematch button (light theme).
 *
 * Supports 2..6 players. The winner headline shows the owner's color via
 * an inline style (Tailwind JIT can't synthesize dynamic hex colors).
 */

import { Suspense, lazy, useMemo, type CSSProperties } from 'react';
import { Marks, indexOf } from '@/lib/rubikCube';

const CubeScene = lazy(() => import('./CubeScene'));

export interface WinningLineData {
    face: number;
    cells: Array<[number, number]>;
    player: number;
}

export interface CubeTacPlayerLite {
    id: number | null;
    nickname: string;
    avatar_color: string;
    /** Glyph-design index (0..5): X / O / △ / ▢ / ✚ / ⬡. */
    design: number;
    wins: number;
}

export interface FinishedPhaseProps {
    marks: Marks;
    winner: number | 'draw';
    winningLines: WinningLineData[];
    /** One entry per slot. */
    players: CubeTacPlayerLite[];
    mySlot: number | null;
    canRematch: boolean;
    onRematch?: () => void;
    onLeave?: () => void;
    leaveLabel?: string;
}

export default function FinishedPhase({
    marks,
    winner,
    winningLines,
    players,
    mySlot,
    canRematch,
    onRematch,
    onLeave,
    leaveLabel = 'Back to menu',
}: FinishedPhaseProps) {
    const winningIndices = useMemo(() => {
        const set = new Set<number>();
        for (const line of winningLines) {
            for (const [r, c] of line.cells) {
                set.add(indexOf(line.face, r, c));
            }
        }
        return set;
    }, [winningLines]);

    const playerColors = useMemo(() => players.map((p) => p.avatar_color), [players]);
    const playerDesigns = useMemo(() => players.map((p, slot) => p.design ?? slot), [players]);

    const isDraw = winner === 'draw';
    const winnerPlayer = !isDraw && typeof winner === 'number' ? players[winner] ?? null : null;
    const winnerColor = winnerPlayer?.avatar_color ?? '#f9b233';
    const didIWin = mySlot !== null && mySlot === winner;

    const headline = isDraw
        ? 'Draw!'
        : mySlot === null
            ? `${winnerPlayer?.nickname ?? 'Player'} Wins!`
            : didIWin
                ? 'You Win!'
                : 'You Lose';

    const subHeadline = isDraw
        ? 'No three-in-a-row'
        : `${winnerPlayer?.nickname ?? 'Unknown'} · 3 in a row`;

    const headlineStyle: CSSProperties = {
        color: winnerColor,
        filter: `drop-shadow(0 0 18px ${hexWithAlpha(winnerColor, 0.45)})`,
    };

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="relative flex-1 min-h-0">
                <Suspense fallback={<div className="h-full" />}>
                    <CubeScene
                        marks={marks}
                        playerColors={playerColors}
                        designs={playerDesigns}
                        winningIndices={winningIndices}
                        interactive={false}
                    />
                </Suspense>

                {/* Reveal overlay */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start pt-8 sm:pt-14">
                    <div className="animate-winReveal flex flex-col items-center">
                        <div className="text-5xl font-black leading-none sm:text-7xl" style={headlineStyle}>
                            {headline}
                        </div>
                        <div className="mt-3 rounded-full bg-white/80 px-4 py-1 text-xs font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md backdrop-blur-xs sm:text-sm">
                            {subHeadline}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-4 border-t-2 border-yellow-600/30 bg-white/85 px-4 py-5 backdrop-blur-xs">
                <Scoreboard players={players} winnerSlot={isDraw ? null : typeof winner === 'number' ? winner : null} />
                <div className="flex gap-3">
                    {canRematch && onRematch && (
                        <button
                            type="button"
                            onClick={onRematch}
                            className="rounded-full bg-linear-to-r from-orange-500 via-red-500 to-pink-600 px-8 py-3 text-lg font-black text-white shadow-xl border-b-4 border-red-700 transition hover:scale-[1.03] hover:shadow-2xl"
                        >
                            Play Again
                        </button>
                    )}
                    {onLeave && (
                        <button
                            type="button"
                            onClick={onLeave}
                            className="rounded-full bg-white px-8 py-3 text-xs font-black uppercase tracking-[0.25em] text-yellow-900 shadow-md border-b-4 border-yellow-300 transition hover:bg-yellow-50"
                        >
                            {leaveLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

interface ScoreboardProps {
    players: CubeTacPlayerLite[];
    /** Slot index of the player who just won this match, or null for a draw. */
    winnerSlot: number | null;
}

function Scoreboard({ players, winnerSlot }: ScoreboardProps) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            {players.map((p, slot) => {
                const isWinner = slot === winnerSlot;
                const rowStyle: CSSProperties = isWinner
                    ? { borderColor: p.avatar_color, boxShadow: `0 0 14px ${hexWithAlpha(p.avatar_color, 0.45)}` }
                    : {};
                return (
                    <div
                        key={slot}
                        style={rowStyle}
                        className={`flex items-center gap-2 rounded-full border-2 bg-white px-3 py-1 text-sm font-black shadow-sm ${
                            isWinner ? 'text-gray-900' : 'border-gray-200 text-gray-700'
                        }`}
                    >
                        <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: p.avatar_color }}
                        />
                        <span className="max-w-[8rem] truncate">{p.nickname}</span>
                        <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-black text-yellow-900">
                            🏆 {p.wins}
                        </span>
                    </div>
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
    if (h.length !== 6) return `rgba(249, 178, 51, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
