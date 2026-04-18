/**
 * Local (pass-and-play) CubeTac.
 *
 * Pure client state — no server round-trip per move, no polling, no DB
 * writes. The reducer owns the entire game state and mirrors the PHP
 * controller's transition logic on the server side.
 *
 * Supports 2..6 players selected via a pre-game picker. Slot 0/1 are X/O
 * (keeping the 2-player feel identical), 2..5 add triangle/square/plus/hexagon.
 */

import GameLayout from '@/Layouts/GameLayout';
import PlayingPhase, { SLOT_CHARS } from '@/Pages/Rooms/CubeTac/PlayingPhase';
import FinishedPhase from '@/Pages/Rooms/CubeTac/FinishedPhase';
import type { CubeSceneHandle } from '@/Pages/Rooms/CubeTac/CubeScene';
import { Head, router } from '@inertiajs/react';
import { useReducer, useRef, useState, type CSSProperties } from 'react';
import {
    Marks,
    Move,
    apply,
    faceRowCol,
    indexOf,
    initialMarks,
    isComplete,
    winningLines,
    WinningLine,
} from '@/lib/rubikCube';

const MOVES_PER_PLAYER = 30;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

/** Palette mirrors the backend SLOT_COLORS in CubeTacGameController.php. */
const PALETTE = ['#ff4d2e', '#3a90ff', '#16a34a', '#a855f7', '#f59e0b', '#c2813a'];

interface LocalState {
    marks: Marks;
    currentTurn: number;
    moveCount: number;
    moveLimit: number;
    winner: number | 'draw' | null;
    winningLines: WinningLine[];
    playerCount: number;
    /** True after a mark is placed; cleared by END_TURN or UNDO_MARK. Rotations never set this. */
    pendingAction: boolean;
    /** Index of the pending mark's sticker — drives "click again to undo". */
    pendingMarkIndex: number | null;
    /** Cumulative wins per slot; survives RESET so rematches keep score. */
    wins: number[];
    /** Total completed games (wins + draws); survives RESET. Feeds rounds. */
    gamesPlayed: number;
}

type LocalAction =
    | { type: 'MARK'; face: number; row: number; col: number }
    | { type: 'UNDO_MARK' }
    | { type: 'ROTATE'; move: Move }
    | { type: 'END_TURN' }
    | { type: 'RESET' };

function freshState(playerCount: number): LocalState {
    return {
        marks: initialMarks(),
        currentTurn: 0,
        moveCount: 0,
        moveLimit: MOVES_PER_PLAYER * playerCount,
        winner: null,
        winningLines: [],
        playerCount,
        pendingAction: false,
        pendingMarkIndex: null,
        wins: Array(playerCount).fill(0),
        gamesPlayed: 0,
    };
}

function reducer(state: LocalState, action: LocalAction): LocalState {
    if (action.type === 'RESET') {
        // Preserve the per-slot wins tally and games-played counter across
        // rematches — only the board itself resets. Changing player count
        // remounts the component, which is the only thing that clears these.
        return {
            ...freshState(state.playerCount),
            wins: state.wins,
            gamesPlayed: state.gamesPlayed,
        };
    }

    if (state.winner !== null) {
        return state; // game over, ignore moves
    }

    if (action.type === 'END_TURN') {
        if (!state.pendingAction) {
            return state;
        }
        return {
            ...state,
            currentTurn: (state.currentTurn + 1) % state.playerCount,
            pendingAction: false,
            pendingMarkIndex: null,
        };
    }

    if (action.type === 'UNDO_MARK') {
        if (!state.pendingAction || state.pendingMarkIndex === null) {
            return state;
        }
        const clearedMarks: Marks = [...state.marks];
        clearedMarks[state.pendingMarkIndex] = null;
        return {
            ...state,
            marks: clearedMarks,
            moveCount: Math.max(0, state.moveCount - 1),
            pendingAction: false,
            pendingMarkIndex: null,
        };
    }

    // Any further action (MARK / ROTATE) is blocked while a mark is pending.
    if (state.pendingAction) {
        return state;
    }

    let newMarks: Marks;
    if (action.type === 'MARK') {
        const idx = indexOf(action.face, action.row, action.col);
        if (state.marks[idx] !== null) {
            return state; // sticker not empty
        }
        newMarks = [...state.marks];
        newMarks[idx] = state.currentTurn;
    } else {
        newMarks = apply(action.move, state.marks);
    }

    const nextCount = state.moveCount + 1;
    const allLines = winningLines(newMarks);

    if (allLines.length > 0) {
        // Current player wins (even if only another player's line exists, per rule).
        const mine = allLines.filter((l) => l.player === state.currentTurn);
        const nextWins = [...state.wins];
        nextWins[state.currentTurn] = (nextWins[state.currentTurn] ?? 0) + 1;
        return {
            ...state,
            marks: newMarks,
            moveCount: nextCount,
            winner: state.currentTurn,
            winningLines: mine.length > 0 ? mine : allLines,
            pendingAction: false,
            pendingMarkIndex: null,
            wins: nextWins,
            gamesPlayed: state.gamesPlayed + 1,
        };
    }

    if (nextCount >= state.moveLimit || isComplete(newMarks)) {
        return {
            ...state,
            marks: newMarks,
            moveCount: nextCount,
            winner: 'draw',
            winningLines: [],
            pendingAction: false,
            pendingMarkIndex: null,
            gamesPlayed: state.gamesPlayed + 1,
        };
    }

    // MARK waits for confirm; ROTATE auto-advances.
    if (action.type === 'MARK') {
        return {
            ...state,
            marks: newMarks,
            moveCount: nextCount,
            pendingAction: true,
            pendingMarkIndex: indexOf(action.face, action.row, action.col),
        };
    }

    return {
        ...state,
        marks: newMarks,
        currentTurn: (state.currentTurn + 1) % state.playerCount,
        moveCount: nextCount,
        pendingAction: false,
        pendingMarkIndex: null,
    };
}

export default function LocalGame() {
    const [playerCount, setPlayerCount] = useState<number | null>(null);
    const handleLeave = () => {
        router.get(route('games.show', 'cubetac'));
    };

    return (
        <GameLayout fullHeight={true}>
            <Head title="CubeTac — Local" />
            {playerCount === null ? (
                <PlayerCountPicker onPick={setPlayerCount} onLeave={handleLeave} />
            ) : (
                <LocalGameBoard
                    playerCount={playerCount}
                    onLeave={handleLeave}
                    onChangeCount={() => setPlayerCount(null)}
                />
            )}
        </GameLayout>
    );
}

// -----------------------------------------------------------------------------

interface PlayerCountPickerProps {
    onPick: (count: number) => void;
    onLeave: () => void;
}

function PlayerCountPicker({ onPick, onLeave }: PlayerCountPickerProps) {
    const options = Array.from(
        { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
        (_, i) => i + MIN_PLAYERS,
    );

    return (
        <div className="flex h-full w-full flex-col overflow-auto px-4 py-6 sm:px-8">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onLeave}
                    className="inline-flex items-center gap-1.5 text-yellow-900 hover:text-yellow-700 font-bold transition text-sm"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-900/70">
                    Local Match
                </div>
                <span className="h-5 w-5" />
            </div>

            <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-6">
                <h2 className="text-3xl font-black text-yellow-900 drop-shadow-xs sm:text-4xl">
                    How many players?
                </h2>
                <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-yellow-900/60">
                    Pass and play on one device
                </p>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {options.map((count) => (
                        <button
                            key={count}
                            type="button"
                            onClick={() => onPick(count)}
                            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 shadow-md transition hover:-translate-y-0.5 hover:border-yellow-400 hover:shadow-lg"
                        >
                            <span className="text-3xl font-black text-yellow-900">{count}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                                player{count === 1 ? '' : 's'}
                            </span>
                            <span
                                className="mt-1 flex gap-1 text-lg font-black"
                                aria-hidden="true"
                            >
                                {Array.from({ length: count }, (_, slot) => (
                                    <span key={slot} style={{ color: PALETTE[slot] }}>
                                        {SLOT_CHARS[slot]}
                                    </span>
                                ))}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------

interface LocalGameBoardProps {
    playerCount: number;
    onLeave: () => void;
    onChangeCount: () => void;
}

function LocalGameBoard({ playerCount, onLeave, onChangeCount }: LocalGameBoardProps) {
    const [state, dispatch] = useReducer(reducer, playerCount, freshState);
    const cubeRef = useRef<CubeSceneHandle>(null);

    const players = Array.from({ length: playerCount }, (_, slot) => ({
        id: null as number | null,
        nickname: `Player ${slot + 1}`,
        avatar_color: PALETTE[slot] ?? '#5b9bd5',
        wins: state.wins[slot] ?? 0,
    }));

    const handleMark = (face: number, row: number, col: number) => {
        dispatch({ type: 'MARK', face, row, col });
    };
    const handleRotate = (move: Move) => {
        // Queue the visual animation first so CubeScene's `isAnimatingRef`
        // is set before the dispatch-driven marks prop update propagates.
        cubeRef.current?.playMove(move);
        dispatch({ type: 'ROTATE', move });
    };
    const handleEndTurn = () => {
        dispatch({ type: 'END_TURN' });
    };
    const handleUndoMark = () => {
        dispatch({ type: 'UNDO_MARK' });
    };
    const handleReset = () => {
        dispatch({ type: 'RESET' });
    };

    // PlayingPhase reads `lastAction.{face,row,col}` to know which sticker
    // is the pending-undo target. In local mode we derive it from the
    // reducer's `pendingMarkIndex` so the two data sources stay aligned.
    const lastAction = state.pendingMarkIndex !== null
        ? (() => {
            const [face, row, col] = faceRowCol(state.pendingMarkIndex);
            return { type: 'mark' as const, face, row, col };
        })()
        : null;

    // Floating "change player count" affordance, visible in the pre-game
    // state (before anyone has made a move) so users can back out of their
    // pick without losing progress they've already made.
    const canChangeCount = state.moveCount === 0 && state.winner === null;
    const changeCountStyle: CSSProperties = { zIndex: 20 };

    return (
        <div className="relative flex h-full flex-col">
            {state.winner === null ? (
                <>
                    <PlayingPhase
                        cubeRef={cubeRef}
                        marks={state.marks}
                        currentTurn={state.currentTurn}
                        moveCount={state.moveCount}
                        moveLimit={state.moveLimit}
                        players={players}
                        mySlot={null}
                        isMyTurn={true}
                        pendingAction={state.pendingAction}
                        lastAction={lastAction}
                        onMark={handleMark}
                        onRotate={handleRotate}
                        onEndTurn={handleEndTurn}
                        onUndoMark={handleUndoMark}
                        turnLabelOverride={`${players[state.currentTurn]?.nickname ?? 'Player'}'s Turn`}
                        onLeave={onLeave}
                        gamesPlayed={state.gamesPlayed}
                    />
                    {canChangeCount && (
                        <button
                            type="button"
                            onClick={onChangeCount}
                            className="absolute right-4 top-16 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-900 shadow-md backdrop-blur-xs transition hover:bg-white"
                            style={changeCountStyle}
                        >
                            {playerCount} players — change
                        </button>
                    )}
                </>
            ) : (
                <FinishedPhase
                    marks={state.marks}
                    winner={state.winner}
                    winningLines={state.winningLines}
                    players={players}
                    mySlot={null}
                    canRematch={true}
                    onRematch={handleReset}
                    onLeave={onLeave}
                    leaveLabel="Main menu"
                />
            )}
        </div>
    );
}
