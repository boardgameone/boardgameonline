/**
 * Active-game phase for CubeTac (light theme).
 *
 * Receives a uniform props shape that works for both online mode (fed by
 * Inertia poll) and local hotseat mode (fed by reducer). The parent is
 * responsible for turning user actions into the correct side effect
 * (HTTP POST vs. reducer dispatch).
 *
 * Supports 2..6 players. Player 0/1 use X/O for the HUD chip (matching
 * the 3D cube glyphs); 2..5 use triangle, square, plus, hexagon.
 */

import { Suspense, lazy, useMemo, type CSSProperties, type Ref } from 'react';
import { Marks, Move } from '@/lib/rubikCube';
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
    currentTurn: number;
    moveCount: number;
    moveLimit: number;
    /** One entry per slot (0..N-1). Length determines N. */
    players: CubeTacPlayerInfo[];
    /** Viewer's slot, or `null` for spectators / local mode. */
    mySlot: number | null;
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

/** 2D HUD chips for each slot — Unicode chars so the badges stay cheap. */
export const SLOT_CHARS = ['X', 'O', '△', '▢', '✚', '⬡'] as const;

export default function PlayingPhase({
    marks,
    currentTurn,
    moveCount,
    moveLimit,
    players,
    mySlot,
    isMyTurn,
    onMark,
    onRotate,
    turnLabelOverride,
    onLeave,
    cubeRef,
}: PlayingPhaseProps) {
    const markCounts = useMemo(() => countMarksBySlot(marks, players.length), [marks, players.length]);
    const playerColors = useMemo(() => players.map((p) => p.avatar_color), [players]);

    const currentPlayer = players[currentTurn];
    const currentColor = currentPlayer?.avatar_color ?? '#5b9bd5';
    const turnLabel =
        turnLabelOverride ??
        (mySlot === null
            ? `${currentPlayer?.nickname ?? SLOT_CHARS[currentTurn] ?? '?'} to move`
            : isMyTurn
                ? 'Your Turn'
                : `${currentPlayer?.nickname ?? 'Opponent'}'s Turn`);

    const subLabel = isMyTurn || turnLabelOverride ? 'Tap a sticker · or rotate a face' : 'Waiting…';

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            {/* Top bar: leave button + move counter */}
            <div className="flex items-center justify-between px-4 pt-3 sm:px-6">
                {onLeave ? (
                    <button
                        type="button"
                        onClick={onLeave}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-bold text-yellow-900 shadow-md backdrop-blur-xs transition hover:bg-white hover:text-yellow-700"
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

                <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gray-700 shadow-md backdrop-blur-xs">
                    Move {moveCount} / {moveLimit}
                </div>

                <span className="h-9 w-9" />
            </div>

            {/* Turn banner */}
            <div className="mt-3 flex flex-col items-center">
                <div
                    className="text-3xl font-black leading-none sm:text-4xl drop-shadow-xs"
                    style={{ color: currentColor }}
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
                        playerColors={playerColors}
                        onStickerClick={isMyTurn ? onMark : undefined}
                        interactive={isMyTurn}
                    />
                </Suspense>

                {!isMyTurn && !turnLabelOverride && (
                    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                        <div className="rounded-full bg-white/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md backdrop-blur-xs">
                            waiting for opponent
                        </div>
                    </div>
                )}
            </div>

            {/* Player HUD + rotate controls */}
            <div className="flex flex-col gap-3 border-t-2 border-yellow-600/30 bg-white/80 px-4 py-4 backdrop-blur-xs sm:px-6">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    {players.map((p, slot) => (
                        <PlayerBadge
                            key={slot}
                            player={p}
                            slot={slot}
                            isActive={currentTurn === slot}
                            markCount={markCounts[slot] ?? 0}
                        />
                    ))}
                </div>

                <RotateControls onRotate={onRotate} disabled={!isMyTurn} />
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------

interface PlayerBadgeProps {
    player: CubeTacPlayerInfo;
    slot: number;
    isActive: boolean;
    markCount: number;
}

function PlayerBadge({ player, slot, isActive, markCount }: PlayerBadgeProps) {
    const color = player.avatar_color;
    const char = SLOT_CHARS[slot] ?? '?';

    // Active player gets a colored ring + drop glow. Inline styles for the
    // dynamic color — Tailwind v3 JIT can't synthesize arbitrary class names.
    const activeStyle: CSSProperties = isActive
        ? {
              borderColor: color,
              boxShadow: `0 0 22px ${hexWithAlpha(color, 0.45)}`,
          }
        : {};

    return (
        <div
            className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-2.5 py-1.5 shadow-xs transition"
            style={activeStyle}
        >
            <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full ring-2 ring-white text-lg font-black"
                style={{ backgroundColor: hexWithAlpha(color, 0.15), color }}
            >
                {char}
            </div>
            <div className="flex flex-col leading-tight">
                <span className="max-w-[96px] truncate text-xs font-black text-gray-900">
                    {player.nickname || 'Waiting…'}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                    {markCount} marks
                </span>
            </div>
        </div>
    );
}

function countMarksBySlot(marks: Marks, n: number): number[] {
    const out = new Array<number>(n).fill(0);
    for (const m of marks) {
        if (m !== null && m !== undefined && m >= 0 && m < n) {
            out[m] += 1;
        }
    }
    return out;
}

/** Expand a #rrggbb string to `rgba(r, g, b, a)`. Tolerates #rgb shorthand. */
function hexWithAlpha(hex: string, alpha: number): string {
    let h = hex.replace('#', '');
    if (h.length === 3) {
        h = h.split('').map((c) => c + c).join('');
    }
    if (h.length !== 6) return `rgba(91, 155, 213, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

