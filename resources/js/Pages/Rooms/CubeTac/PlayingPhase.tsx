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
import { Marks, Move, indexOf } from '@/lib/rubikCube';
import RotateControls from './components/RotateControls';
import type { CubeSceneHandle } from './CubeScene';

const CubeScene = lazy(() => import('./CubeScene'));

export interface CubeTacPlayerInfo {
    id: number | null;
    nickname: string;
    avatar_color: string;
    /** Cumulative wins in this lobby (online) or session (local hotseat). */
    wins: number;
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
    /**
     * True after the current player has placed a mark but not yet clicked
     * Confirm Turn. Marks/rotations are blocked; the Confirm button is shown.
     * Rotations never set this — they auto-advance the turn.
     */
    pendingAction: boolean;
    /**
     * Most recent action's metadata. When `pendingAction` is true and this
     * is a mark, its `{face,row,col}` identifies the sticker the current
     * player can click again to undo.
     */
    lastAction?: Record<string, unknown> | null;
    onMark: (face: number, row: number, col: number) => void;
    onRotate: (move: Move) => void;
    onEndTurn: () => void;
    onUndoMark: () => void;
    /** Banner override — used by local mode to show "Player 1's turn" etc. */
    turnLabelOverride?: string;
    /** Back / leave handler */
    onLeave?: () => void;
    /** Ref for the cube scene's imperative handle (drives rotation animation). */
    cubeRef?: Ref<CubeSceneHandle>;
    /**
     * Total completed games in this lobby (wins + draws). Feeds the round
     * indicator in the leaderboard — a round is one game per player.
     */
    gamesPlayed: number;
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
    pendingAction,
    lastAction,
    onMark,
    onRotate,
    onEndTurn,
    onUndoMark,
    turnLabelOverride,
    onLeave,
    cubeRef,
    gamesPlayed,
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

    const canAct = isMyTurn && !pendingAction;
    const pendingMark = pendingAction && lastAction && lastAction.type === 'mark'
        ? {
            face: lastAction.face as number,
            row: lastAction.row as number,
            col: lastAction.col as number,
        }
        : null;
    const pendingIndex = pendingMark
        ? indexOf(pendingMark.face, pendingMark.row, pendingMark.col)
        : null;
    const subLabel = pendingAction && isMyTurn
        ? 'Confirm · or tap your mark to undo'
        : canAct || turnLabelOverride
            ? 'Tap a sticker · or rotate a face'
            : 'Waiting…';

    // One click handler, two behaviors: clicking an empty sticker marks it;
    // clicking the pending mark (same face/row/col) undoes it. Any other
    // click (already-marked stickers, etc.) is ignored.
    const handleStickerClick = (face: number, row: number, col: number) => {
        if (pendingMark
            && pendingMark.face === face
            && pendingMark.row === row
            && pendingMark.col === col) {
            onUndoMark();
            return;
        }
        if (canAct && marks[indexOf(face, row, col)] === null) {
            onMark(face, row, col);
        }
    };
    const stickerClickActive = isMyTurn && (canAct || pendingMark !== null);

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
                        pendingIndex={pendingIndex}
                        onStickerClick={stickerClickActive ? handleStickerClick : undefined}
                        interactive={stickerClickActive}
                    />
                </Suspense>

                {!isMyTurn && !turnLabelOverride && (
                    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                        <div className="rounded-full bg-white/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md backdrop-blur-xs">
                            waiting for opponent
                        </div>
                    </div>
                )}

                <Leaderboard
                    players={players}
                    currentTurn={currentTurn}
                    gamesPlayed={gamesPlayed}
                />
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

                <RotateControls onRotate={onRotate} disabled={!canAct} />

                {isMyTurn && pendingAction && (
                    <div className="flex justify-center pt-1">
                        <button
                            type="button"
                            onClick={onEndTurn}
                            aria-label="End turn"
                            className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg border-b-4 border-emerald-700 transition hover:scale-[1.03] hover:from-emerald-600 hover:to-teal-600 active:scale-95"
                            style={{ boxShadow: `0 8px 22px ${hexWithAlpha(currentColor, 0.35)}` }}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Confirm Turn
                        </button>
                    </div>
                )}
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

// -----------------------------------------------------------------------------

interface LeaderboardProps {
    players: CubeTacPlayerInfo[];
    currentTurn: number;
    /** Games already completed in this lobby (feeds the round indicator). */
    gamesPlayed: number;
}

/**
 * Always-visible per-slot wins tally floated on the right edge of the cube
 * canvas, plus a round indicator. A round is N games (one game per player),
 * so with N=3 the indicator cycles R1 G1/3 → R1 G2/3 → R1 G3/3 → R2 G1/3…
 *
 * Hidden on mobile (< sm) where the cube takes most of the viewport; the
 * bottom HUD still shows players and FinishedPhase surfaces the scoreboard
 * between games.
 */
function Leaderboard({ players, currentTurn, gamesPlayed }: LeaderboardProps) {
    const n = Math.max(1, players.length);
    const round = Math.floor(gamesPlayed / n) + 1;
    const gameInRound = (gamesPlayed % n) + 1;

    return (
        <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
            <div className="rounded-xl bg-white/90 px-3 py-1.5 text-center shadow-md backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">
                    Round {round}
                </div>
                <div className="text-[11px] font-black text-gray-900">
                    Game {gameInRound} / {n}
                </div>
            </div>
            {players.map((p, slot) => (
                <LeaderboardRow
                    key={slot}
                    player={p}
                    slot={slot}
                    isActive={currentTurn === slot}
                />
            ))}
        </div>
    );
}

interface LeaderboardRowProps {
    player: CubeTacPlayerInfo;
    slot: number;
    isActive: boolean;
}

function LeaderboardRow({ player, slot, isActive }: LeaderboardRowProps) {
    const color = player.avatar_color;
    const char = SLOT_CHARS[slot] ?? '?';

    const rowStyle: CSSProperties = isActive
        ? {
              borderColor: color,
              boxShadow: `0 0 14px ${hexWithAlpha(color, 0.45)}`,
          }
        : {};

    return (
        <div
            className="flex items-center gap-2 rounded-full border-2 border-gray-200 bg-white px-2 py-1 shadow-md"
            style={rowStyle}
        >
            <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black"
                style={{ backgroundColor: hexWithAlpha(color, 0.15), color }}
            >
                {char}
            </div>
            <span className="max-w-[7rem] truncate text-xs font-black text-gray-900">
                {player.nickname || `Player ${slot + 1}`}
            </span>
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-yellow-200 px-1.5 py-0.5 text-[10px] font-black text-yellow-900">
                <span aria-hidden="true">🏆</span>
                {player.wins}
            </span>
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

