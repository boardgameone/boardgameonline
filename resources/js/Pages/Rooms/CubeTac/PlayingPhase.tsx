/**
 * Active-game phase for CubeTac (light theme).
 *
 * Receives a uniform props shape that works for both online mode (fed by
 * Inertia poll) and local hotseat mode (fed by reducer). The parent is
 * responsible for turning user actions into the correct side effect
 * (HTTP POST vs. reducer dispatch).
 */

import { Suspense, lazy, useMemo, type Ref } from 'react';
import { Marks, Mark, Move } from '@/lib/rubikCube';
import RotateControls from './components/RotateControls';
import type { CubeSceneHandle } from './CubeScene';

const CubeScene = lazy(() => import('./CubeScene'));

export interface CubeTacPlayerInfo {
    id: number | null;
    nickname: string;
    avatar_color: string;
}

export interface PlayingPhaseProps {
    marks: Marks;
    currentTurn: 'X' | 'O';
    moveCount: number;
    moveLimit: number;
    xPlayer: CubeTacPlayerInfo;
    oPlayer: CubeTacPlayerInfo;
    mySymbol: 'X' | 'O' | null;
    isMyTurn: boolean;
    onMark: (face: number, row: number, col: number) => void;
    onRotate: (move: Move) => void;
    /** Banner override — used by local mode to show "Player 1's turn" etc. */
    turnLabelOverride?: string;
    /** Back / leave handler */
    onLeave?: () => void;
    /** Ref for the cube scene's imperative handle (drives rotation animation). */
    cubeRef?: Ref<CubeSceneHandle>;
}

export default function PlayingPhase({
    marks,
    currentTurn,
    moveCount,
    moveLimit,
    xPlayer,
    oPlayer,
    mySymbol,
    isMyTurn,
    onMark,
    onRotate,
    turnLabelOverride,
    onLeave,
    cubeRef,
}: PlayingPhaseProps) {
    const xCount = useMemo(() => countMarks(marks, 'X'), [marks]);
    const oCount = useMemo(() => countMarks(marks, 'O'), [marks]);

    const turnLabel =
        turnLabelOverride ??
        (mySymbol === null
            ? `${currentTurn} to move`
            : isMyTurn
                ? 'Your Turn'
                : "Opponent's Turn");

    const subLabel = isMyTurn || turnLabelOverride ? 'Tap a sticker · or rotate a face' : 'Waiting…';

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            {/* Top bar: leave button + move counter */}
            <div className="flex items-center justify-between px-4 pt-3 sm:px-6">
                {onLeave ? (
                    <button
                        type="button"
                        onClick={onLeave}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-bold text-yellow-900 shadow-md backdrop-blur-sm transition hover:bg-white hover:text-yellow-700"
                        aria-label="Leave game"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                ) : (
                    <span className="h-9 w-9" />
                )}

                <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gray-700 shadow-md backdrop-blur-sm">
                    Move {moveCount} / {moveLimit}
                </div>

                <span className="h-9 w-9" />
            </div>

            {/* Turn banner */}
            <div className="mt-3 flex flex-col items-center">
                <div
                    className={`text-3xl font-black leading-none sm:text-4xl drop-shadow-sm ${
                        currentTurn === 'X' ? 'text-red-500' : 'text-blue-600'
                    }`}
                >
                    {turnLabel}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-600">
                    {subLabel}
                </div>
            </div>

            {/* Cube canvas */}
            <div className="relative flex-1 min-h-0">
                <Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center">
                            <div className="text-xs font-bold uppercase tracking-[0.4em] text-gray-500">
                                Loading cube…
                            </div>
                        </div>
                    }
                >
                    <CubeScene
                        ref={cubeRef}
                        marks={marks}
                        onStickerClick={isMyTurn ? onMark : undefined}
                        interactive={isMyTurn}
                    />
                </Suspense>

                {!isMyTurn && !turnLabelOverride && (
                    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                        <div className="rounded-full bg-white/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md backdrop-blur-sm">
                            waiting for opponent
                        </div>
                    </div>
                )}
            </div>

            {/* Player HUD + rotate controls */}
            <div className="flex flex-col gap-3 border-t-2 border-yellow-600/30 bg-white/80 px-4 py-4 backdrop-blur-sm sm:px-6">
                <div className="flex items-center justify-between gap-3">
                    <PlayerBadge
                        player={xPlayer}
                        symbol="X"
                        isActive={currentTurn === 'X'}
                        markCount={xCount}
                        align="left"
                    />
                    <PlayerBadge
                        player={oPlayer}
                        symbol="O"
                        isActive={currentTurn === 'O'}
                        markCount={oCount}
                        align="right"
                    />
                </div>

                <RotateControls onRotate={onRotate} disabled={!isMyTurn} />
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------

interface PlayerBadgeProps {
    player: CubeTacPlayerInfo;
    symbol: 'X' | 'O';
    isActive: boolean;
    markCount: number;
    align: 'left' | 'right';
}

function PlayerBadge({ player, symbol, isActive, markCount, align }: PlayerBadgeProps) {
    const symbolColor = symbol === 'X' ? 'text-red-500' : 'text-blue-600';
    const ringClass = symbol === 'X' ? 'ring-red-400' : 'ring-blue-400';
    const glow = symbol === 'X'
        ? 'shadow-[0_0_22px_rgba(239,68,68,0.4)]'
        : 'shadow-[0_0_22px_rgba(37,99,235,0.4)]';
    const bgTint = symbol === 'X' ? 'bg-red-50' : 'bg-blue-50';

    return (
        <div
            className={`flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 shadow-sm transition ${
                isActive ? `ring-2 ${ringClass} ${glow}` : ''
            } ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
        >
            <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${bgTint} ring-2 ring-gray-200 ${symbolColor}`}
            >
                <span className="text-xl font-black">{symbol}</span>
            </div>
            <div className={`flex flex-col leading-tight ${align === 'right' ? 'items-end' : ''}`}>
                <span className="max-w-[110px] truncate text-sm font-black text-gray-900">
                    {player.nickname || 'Waiting…'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {markCount} marks
                </span>
            </div>
        </div>
    );
}

function countMarks(marks: Marks, symbol: Mark): number {
    let n = 0;
    for (const m of marks) if (m === symbol) n++;
    return n;
}
