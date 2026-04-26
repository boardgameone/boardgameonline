/**
 * Local (pass-and-play) CubeTac.
 *
 * Pure client state — no server round-trip per move, no polling, no DB
 * writes. The reducer owns the entire game state and mirrors the PHP
 * controller's transition logic on the server side.
 *
 * Supports two variants picked before the match starts (cube or megaminx)
 * and 2..6 players. Slots 0/1 are X/O (keeping the 2-player feel identical),
 * 2..5 add triangle/square/plus/hexagon.
 */

import GameLayout from '@/Layouts/GameLayout';
import PlayingPhase, { SLOT_CHARS } from '@/Pages/Rooms/CubeTac/PlayingPhase';
import FinishedPhase from '@/Pages/Rooms/CubeTac/FinishedPhase';
import type { CubeSceneHandle } from '@/Pages/Rooms/CubeTac/CubeScene';
import type { MegaminxSceneHandle } from '@/Pages/Rooms/CubeTac/MegaminxScene';
import type { PyraminxSceneHandle } from '@/Pages/Rooms/CubeTac/PyraminxScene';
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
import {
    Direction as MegaDirection,
    Marks as MegaMarks,
    apply as megaApply,
    faceSlot as megaFaceSlot,
    indexOf as megaIndexOf,
    initialMarks as megaInitialMarks,
    isComplete as megaIsComplete,
    winningLines as megaWinningLines,
} from '@/lib/megaminx';
import {
    Direction as PyraDirection,
    Marks as PyraMarks,
    apply as pyraApply,
    faceSlot as pyraFaceSlot,
    indexOf as pyraIndexOf,
    initialMarks as pyraInitialMarks,
    isComplete as pyraIsComplete,
    winningLines as pyraWinningLines,
} from '@/lib/pyraminx';

const MOVES_PER_PLAYER = 30;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

type Variant = 'cube' | 'megaminx' | 'pyraminx';

/** Palette mirrors the backend SLOT_COLORS in CubeTacGameController.php. */
const PALETTE = ['#ff4d2e', '#3a90ff', '#16a34a', '#a855f7', '#f59e0b', '#c2813a'];

// ---------------------------------------------------------------------------
// Top-level shell — picks variant + player count, then mounts the right board.
// ---------------------------------------------------------------------------

export default function LocalGame() {
    const [variant, setVariant] = useState<Variant>('cube');
    const [playerCount, setPlayerCount] = useState<number | null>(null);

    const handleLeave = () => {
        router.get(route('games.show', 'cubetac'));
    };
    const handleChangeSetup = () => setPlayerCount(null);

    return (
        <GameLayout fullHeight={true}>
            <Head title="CubeTac — Local" />
            {playerCount === null ? (
                <Picker
                    variant={variant}
                    onVariantChange={setVariant}
                    onPickCount={setPlayerCount}
                    onLeave={handleLeave}
                />
            ) : variant === 'megaminx' ? (
                <MegaminxLocalBoard
                    playerCount={playerCount}
                    onLeave={handleLeave}
                    onChangeSetup={handleChangeSetup}
                />
            ) : variant === 'pyraminx' ? (
                <PyraminxLocalBoard
                    playerCount={playerCount}
                    onLeave={handleLeave}
                    onChangeSetup={handleChangeSetup}
                />
            ) : (
                <CubeLocalBoard
                    playerCount={playerCount}
                    onLeave={handleLeave}
                    onChangeSetup={handleChangeSetup}
                />
            )}
        </GameLayout>
    );
}

// ---------------------------------------------------------------------------
// Picker — variant toggle + player-count buttons.
// ---------------------------------------------------------------------------

interface PickerProps {
    variant: Variant;
    onVariantChange: (v: Variant) => void;
    onPickCount: (count: number) => void;
    onLeave: () => void;
}

function Picker({ variant, onVariantChange, onPickCount, onLeave }: PickerProps) {
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
                {/* Variant toggle */}
                <div className="flex flex-col items-center gap-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-900/70">
                        Playing surface
                    </div>
                    <div className="inline-flex flex-wrap justify-center rounded-full border-2 border-yellow-400 bg-white/80 p-1 shadow-md">
                        {(['cube', 'megaminx', 'pyraminx'] as const).map((v) => {
                            const selected = v === variant;
                            const label =
                                v === 'cube'
                                    ? 'Cube · 6 faces'
                                    : v === 'megaminx'
                                        ? 'Megaminx · 12 faces'
                                        : 'Pyraminx · 4 faces';
                            return (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => onVariantChange(v)}
                                    aria-pressed={selected}
                                    className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] transition ${
                                        selected
                                            ? 'bg-linear-to-r from-orange-500 to-pink-500 text-white shadow-md'
                                            : 'text-yellow-900 hover:bg-yellow-100/70'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

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
                            onClick={() => onPickCount(count)}
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

// ---------------------------------------------------------------------------
// Cube hotseat — original local logic, only the symbol name changed.
// ---------------------------------------------------------------------------

interface CubeLocalState {
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

type CubeLocalAction =
    | { type: 'MARK'; face: number; row: number; col: number }
    | { type: 'UNDO_MARK' }
    | { type: 'ROTATE'; move: Move }
    | { type: 'END_TURN' }
    | { type: 'RESET' };

function freshCubeState(playerCount: number): CubeLocalState {
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

function cubeReducer(state: CubeLocalState, action: CubeLocalAction): CubeLocalState {
    if (action.type === 'RESET') {
        return {
            ...freshCubeState(state.playerCount),
            wins: state.wins,
            gamesPlayed: state.gamesPlayed,
        };
    }

    if (state.winner !== null) {
        return state;
    }

    if (action.type === 'END_TURN') {
        if (!state.pendingAction) return state;
        return {
            ...state,
            currentTurn: (state.currentTurn + 1) % state.playerCount,
            pendingAction: false,
            pendingMarkIndex: null,
        };
    }

    if (action.type === 'UNDO_MARK') {
        if (!state.pendingAction || state.pendingMarkIndex === null) return state;
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

    if (state.pendingAction) return state;

    let newMarks: Marks;
    if (action.type === 'MARK') {
        const idx = indexOf(action.face, action.row, action.col);
        if (state.marks[idx] !== null) return state;
        newMarks = [...state.marks];
        newMarks[idx] = state.currentTurn;
    } else {
        newMarks = apply(action.move, state.marks);
    }

    const nextCount = state.moveCount + 1;
    const allLines = winningLines(newMarks);

    if (allLines.length > 0) {
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

interface BoardProps {
    playerCount: number;
    onLeave: () => void;
    onChangeSetup: () => void;
}

function CubeLocalBoard({ playerCount, onLeave, onChangeSetup }: BoardProps) {
    const [state, dispatch] = useReducer(cubeReducer, playerCount, freshCubeState);
    const cubeRef = useRef<CubeSceneHandle>(null);

    const players = Array.from({ length: playerCount }, (_, slot) => ({
        id: null as number | null,
        nickname: `Player ${slot + 1}`,
        avatar_color: PALETTE[slot] ?? '#5b9bd5',
        design: slot,
        wins: state.wins[slot] ?? 0,
    }));

    const handleMark = (face: number, row: number, col: number) => {
        dispatch({ type: 'MARK', face, row, col });
    };
    const handleRotate = (move: Move) => {
        cubeRef.current?.playMove(move);
        dispatch({ type: 'ROTATE', move });
    };
    const handleEndTurn = () => dispatch({ type: 'END_TURN' });
    const handleUndoMark = () => dispatch({ type: 'UNDO_MARK' });
    const handleReset = () => dispatch({ type: 'RESET' });

    const lastAction = state.pendingMarkIndex !== null
        ? (() => {
            const [face, row, col] = faceRowCol(state.pendingMarkIndex);
            return { type: 'mark' as const, face, row, col };
        })()
        : null;

    const canChangeSetup = state.moveCount === 0 && state.winner === null;
    const changeSetupStyle: CSSProperties = { zIndex: 20 };

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
                    {canChangeSetup && (
                        <button
                            type="button"
                            onClick={onChangeSetup}
                            className="absolute right-4 top-16 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-900 shadow-md backdrop-blur-xs transition hover:bg-white"
                            style={changeSetupStyle}
                        >
                            Cube · {playerCount} players — change
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

// ---------------------------------------------------------------------------
// Megaminx hotseat — parallel reducer using the lib/megaminx primitives.
// ---------------------------------------------------------------------------

type MegaWinningLine = { face: number; cells: [number, number, number]; player: number };

interface MegaLocalState {
    marks: MegaMarks;
    currentTurn: number;
    moveCount: number;
    moveLimit: number;
    winner: number | 'draw' | null;
    winningLines: MegaWinningLine[];
    playerCount: number;
    pendingAction: boolean;
    pendingMarkIndex: number | null;
    wins: number[];
    gamesPlayed: number;
}

type MegaLocalAction =
    | { type: 'MARK'; face: number; slot: number }
    | { type: 'UNDO_MARK' }
    | { type: 'ROTATE'; face: number; direction: MegaDirection }
    | { type: 'END_TURN' }
    | { type: 'RESET' };

function freshMegaState(playerCount: number): MegaLocalState {
    return {
        marks: megaInitialMarks(),
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

function megaReducer(state: MegaLocalState, action: MegaLocalAction): MegaLocalState {
    if (action.type === 'RESET') {
        return {
            ...freshMegaState(state.playerCount),
            wins: state.wins,
            gamesPlayed: state.gamesPlayed,
        };
    }

    if (state.winner !== null) return state;

    if (action.type === 'END_TURN') {
        if (!state.pendingAction) return state;
        return {
            ...state,
            currentTurn: (state.currentTurn + 1) % state.playerCount,
            pendingAction: false,
            pendingMarkIndex: null,
        };
    }

    if (action.type === 'UNDO_MARK') {
        if (!state.pendingAction || state.pendingMarkIndex === null) return state;
        const clearedMarks: MegaMarks = [...state.marks];
        clearedMarks[state.pendingMarkIndex] = null;
        return {
            ...state,
            marks: clearedMarks,
            moveCount: Math.max(0, state.moveCount - 1),
            pendingAction: false,
            pendingMarkIndex: null,
        };
    }

    if (state.pendingAction) return state;

    let newMarks: MegaMarks;
    if (action.type === 'MARK') {
        const idx = megaIndexOf(action.face, action.slot);
        if (state.marks[idx] !== null) return state;
        newMarks = [...state.marks];
        newMarks[idx] = state.currentTurn;
    } else {
        newMarks = megaApply(action.face, action.direction, state.marks);
    }

    const nextCount = state.moveCount + 1;
    const allLines: MegaWinningLine[] = megaWinningLines(newMarks).map((l) => ({
        face: l.face,
        cells: l.cells,
        player: l.player,
    }));

    if (allLines.length > 0) {
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

    if (nextCount >= state.moveLimit || megaIsComplete(newMarks)) {
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

    if (action.type === 'MARK') {
        return {
            ...state,
            marks: newMarks,
            moveCount: nextCount,
            pendingAction: true,
            pendingMarkIndex: megaIndexOf(action.face, action.slot),
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

function MegaminxLocalBoard({ playerCount, onLeave, onChangeSetup }: BoardProps) {
    const [state, dispatch] = useReducer(megaReducer, playerCount, freshMegaState);
    const megaRef = useRef<MegaminxSceneHandle>(null);

    const players = Array.from({ length: playerCount }, (_, slot) => ({
        id: null as number | null,
        nickname: `Player ${slot + 1}`,
        avatar_color: PALETTE[slot] ?? '#5b9bd5',
        design: slot,
        wins: state.wins[slot] ?? 0,
    }));

    const handleMegaMark = (face: number, slot: number) => {
        dispatch({ type: 'MARK', face, slot });
    };
    const handleMegaRotate = (face: number, direction: MegaDirection) => {
        // PlayingPhase already triggers megaRef.playMove() before invoking
        // onMegaRotate, so don't double-fire here — just commit state.
        dispatch({ type: 'ROTATE', face, direction });
    };
    const handleEndTurn = () => dispatch({ type: 'END_TURN' });
    const handleUndoMark = () => dispatch({ type: 'UNDO_MARK' });
    const handleReset = () => dispatch({ type: 'RESET' });

    const lastAction = state.pendingMarkIndex !== null
        ? (() => {
            const [face, slot] = megaFaceSlot(state.pendingMarkIndex);
            return { type: 'mega_mark' as const, face, slot };
        })()
        : null;

    const canChangeSetup = state.moveCount === 0 && state.winner === null;
    const changeSetupStyle: CSSProperties = { zIndex: 20 };

    return (
        <div className="relative flex h-full flex-col">
            {state.winner === null ? (
                <>
                    <PlayingPhase
                        variant="megaminx"
                        megaRef={megaRef}
                        marks={state.marks}
                        currentTurn={state.currentTurn}
                        moveCount={state.moveCount}
                        moveLimit={state.moveLimit}
                        players={players}
                        mySlot={null}
                        isMyTurn={true}
                        pendingAction={state.pendingAction}
                        lastAction={lastAction}
                        // Cube callbacks are unused in this branch but PlayingPhase
                        // requires them as non-optional props — pass no-ops.
                        onMark={() => {}}
                        onRotate={() => {}}
                        onMegaMark={handleMegaMark}
                        onMegaRotate={handleMegaRotate}
                        onEndTurn={handleEndTurn}
                        onUndoMark={handleUndoMark}
                        turnLabelOverride={`${players[state.currentTurn]?.nickname ?? 'Player'}'s Turn`}
                        onLeave={onLeave}
                        gamesPlayed={state.gamesPlayed}
                    />
                    {canChangeSetup && (
                        <button
                            type="button"
                            onClick={onChangeSetup}
                            className="absolute right-4 top-16 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-900 shadow-md backdrop-blur-xs transition hover:bg-white"
                            style={changeSetupStyle}
                        >
                            Megaminx · {playerCount} players — change
                        </button>
                    )}
                </>
            ) : (
                <FinishedPhase
                    variant="megaminx"
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

// ---------------------------------------------------------------------------
// Pyraminx hotseat — parallel reducer using the lib/pyraminx primitives.
// ---------------------------------------------------------------------------

type PyraWinningLine = { face: number; cells: [number, number, number]; player: number };

interface PyraLocalState {
    marks: PyraMarks;
    currentTurn: number;
    moveCount: number;
    moveLimit: number;
    winner: number | 'draw' | null;
    winningLines: PyraWinningLine[];
    playerCount: number;
    pendingAction: boolean;
    pendingMarkIndex: number | null;
    wins: number[];
    gamesPlayed: number;
}

type PyraLocalAction =
    | { type: 'MARK'; face: number; slot: number }
    | { type: 'UNDO_MARK' }
    | { type: 'ROTATE'; face: number; direction: PyraDirection }
    | { type: 'END_TURN' }
    | { type: 'RESET' };

function freshPyraState(playerCount: number): PyraLocalState {
    return {
        marks: pyraInitialMarks(),
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

function pyraReducer(state: PyraLocalState, action: PyraLocalAction): PyraLocalState {
    if (action.type === 'RESET') {
        return {
            ...freshPyraState(state.playerCount),
            wins: state.wins,
            gamesPlayed: state.gamesPlayed,
        };
    }

    if (state.winner !== null) return state;

    if (action.type === 'END_TURN') {
        if (!state.pendingAction) return state;
        return {
            ...state,
            currentTurn: (state.currentTurn + 1) % state.playerCount,
            pendingAction: false,
            pendingMarkIndex: null,
        };
    }

    if (action.type === 'UNDO_MARK') {
        if (!state.pendingAction || state.pendingMarkIndex === null) return state;
        const clearedMarks: PyraMarks = [...state.marks];
        clearedMarks[state.pendingMarkIndex] = null;
        return {
            ...state,
            marks: clearedMarks,
            moveCount: Math.max(0, state.moveCount - 1),
            pendingAction: false,
            pendingMarkIndex: null,
        };
    }

    if (state.pendingAction) return state;

    let newMarks: PyraMarks;
    if (action.type === 'MARK') {
        const idx = pyraIndexOf(action.face, action.slot);
        if (state.marks[idx] !== null) return state;
        newMarks = [...state.marks];
        newMarks[idx] = state.currentTurn;
    } else {
        newMarks = pyraApply(action.face, action.direction, state.marks);
    }

    const nextCount = state.moveCount + 1;
    const allLines: PyraWinningLine[] = pyraWinningLines(newMarks).map((l) => ({
        face: l.face,
        cells: l.cells,
        player: l.player,
    }));

    if (allLines.length > 0) {
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

    if (nextCount >= state.moveLimit || pyraIsComplete(newMarks)) {
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

    if (action.type === 'MARK') {
        return {
            ...state,
            marks: newMarks,
            moveCount: nextCount,
            pendingAction: true,
            pendingMarkIndex: pyraIndexOf(action.face, action.slot),
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

function PyraminxLocalBoard({ playerCount, onLeave, onChangeSetup }: BoardProps) {
    const [state, dispatch] = useReducer(pyraReducer, playerCount, freshPyraState);
    const pyraRef = useRef<PyraminxSceneHandle>(null);

    const players = Array.from({ length: playerCount }, (_, slot) => ({
        id: null as number | null,
        nickname: `Player ${slot + 1}`,
        avatar_color: PALETTE[slot] ?? '#5b9bd5',
        design: slot,
        wins: state.wins[slot] ?? 0,
    }));

    const handlePyraMark = (face: number, slot: number) => {
        dispatch({ type: 'MARK', face, slot });
    };
    const handlePyraRotate = (face: number, direction: PyraDirection) => {
        dispatch({ type: 'ROTATE', face, direction });
    };
    const handleEndTurn = () => dispatch({ type: 'END_TURN' });
    const handleUndoMark = () => dispatch({ type: 'UNDO_MARK' });
    const handleReset = () => dispatch({ type: 'RESET' });

    const lastAction = state.pendingMarkIndex !== null
        ? (() => {
            const [face, slot] = pyraFaceSlot(state.pendingMarkIndex);
            return { type: 'pyra_mark' as const, face, slot };
        })()
        : null;

    const canChangeSetup = state.moveCount === 0 && state.winner === null;
    const changeSetupStyle: CSSProperties = { zIndex: 20 };

    return (
        <div className="relative flex h-full flex-col">
            {state.winner === null ? (
                <>
                    <PlayingPhase
                        variant="pyraminx"
                        pyraRef={pyraRef}
                        marks={state.marks}
                        currentTurn={state.currentTurn}
                        moveCount={state.moveCount}
                        moveLimit={state.moveLimit}
                        players={players}
                        mySlot={null}
                        isMyTurn={true}
                        pendingAction={state.pendingAction}
                        lastAction={lastAction}
                        // Cube callbacks are unused in this branch but PlayingPhase
                        // requires them as non-optional props — pass no-ops.
                        onMark={() => {}}
                        onRotate={() => {}}
                        onPyraMark={handlePyraMark}
                        onPyraRotate={handlePyraRotate}
                        onEndTurn={handleEndTurn}
                        onUndoMark={handleUndoMark}
                        turnLabelOverride={`${players[state.currentTurn]?.nickname ?? 'Player'}'s Turn`}
                        onLeave={onLeave}
                        gamesPlayed={state.gamesPlayed}
                    />
                    {canChangeSetup && (
                        <button
                            type="button"
                            onClick={onChangeSetup}
                            className="absolute right-4 top-16 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-900 shadow-md backdrop-blur-xs transition hover:bg-white"
                            style={changeSetupStyle}
                        >
                            Pyraminx · {playerCount} players — change
                        </button>
                    )}
                </>
            ) : (
                <FinishedPhase
                    variant="pyraminx"
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
