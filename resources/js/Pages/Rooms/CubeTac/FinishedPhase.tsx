/**
 * Game-over phase: reveal + rematch button (light theme).
 */

import { Suspense, lazy, useMemo } from 'react';
import { Marks, indexOf } from '@/lib/rubikCube';

const CubeScene = lazy(() => import('./CubeScene'));

export interface WinningLineData {
    face: number;
    cells: Array<[number, number]>;
    player: 'X' | 'O';
}

export interface CubeTacPlayerLite {
    id: number | null;
    nickname: string;
}

export interface FinishedPhaseProps {
    marks: Marks;
    winner: 'X' | 'O' | 'draw';
    winningLines: WinningLineData[];
    xPlayer: CubeTacPlayerLite;
    oPlayer: CubeTacPlayerLite;
    mySymbol: 'X' | 'O' | null;
    canRematch: boolean;
    onRematch?: () => void;
    onLeave?: () => void;
    leaveLabel?: string;
}

export default function FinishedPhase({
    marks,
    winner,
    winningLines,
    xPlayer,
    oPlayer,
    mySymbol,
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

    const isDraw = winner === 'draw';
    const winnerName = winner === 'X' ? xPlayer.nickname : winner === 'O' ? oPlayer.nickname : null;
    const didIWin = mySymbol !== null && mySymbol === winner;

    const headline = isDraw
        ? 'Draw!'
        : mySymbol === null
            ? `${winner} Wins!`
            : didIWin
                ? 'You Win!'
                : 'You Lose';

    const subHeadline = isDraw
        ? 'No three-in-a-row'
        : `${winnerName ?? winner} · 3 in a row`;

    const headlineColor = winner === 'X'
        ? 'text-red-500 drop-shadow-[0_0_18px_rgba(239,68,68,0.45)]'
        : winner === 'O'
            ? 'text-blue-600 drop-shadow-[0_0_18px_rgba(37,99,235,0.45)]'
            : 'text-yellow-700 drop-shadow-[0_0_18px_rgba(234,179,8,0.45)]';

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="relative flex-1 min-h-0">
                <Suspense fallback={<div className="h-full" />}>
                    <CubeScene marks={marks} winningIndices={winningIndices} interactive={false} />
                </Suspense>

                {/* Reveal overlay */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start pt-8 sm:pt-14">
                    <div className="animate-winReveal flex flex-col items-center">
                        <div className={`text-5xl font-black leading-none sm:text-7xl ${headlineColor}`}>
                            {headline}
                        </div>
                        <div className="mt-3 rounded-full bg-white/80 px-4 py-1 text-xs font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md backdrop-blur-sm sm:text-sm">
                            {subHeadline}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-3 border-t-2 border-yellow-600/30 bg-white/85 px-4 py-6 backdrop-blur-sm">
                <div className="flex gap-3">
                    {canRematch && onRematch && (
                        <button
                            type="button"
                            onClick={onRematch}
                            className="rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 px-8 py-3 text-lg font-black text-white shadow-xl border-b-4 border-red-700 transition hover:scale-[1.03] hover:shadow-2xl"
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
