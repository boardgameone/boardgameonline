/**
 * Local (pass-and-play) CubeTac.
 *
 * Pure client state — no server round-trip per move, no polling, no DB
 * writes. The reducer owns the entire game state and mirrors the PHP
 * controller's transition logic on the server side.
 */

import GameLayout from '@/Layouts/GameLayout';
import PlayingPhase from '@/Pages/Rooms/CubeTac/PlayingPhase';
import FinishedPhase from '@/Pages/Rooms/CubeTac/FinishedPhase';
import type { CubeSceneHandle } from '@/Pages/Rooms/CubeTac/CubeScene';
import { Head, router } from '@inertiajs/react';
import { useReducer, useRef } from 'react';
import {
    Marks,
    Move,
    apply,
    indexOf,
    initialMarks,
    isComplete,
    winningLines,
    WinningLine,
} from '@/lib/rubikCube';

const MOVE_LIMIT = 60;

interface LocalState {
    marks: Marks;
    currentTurn: 'X' | 'O';
    moveCount: number;
    winner: 'X' | 'O' | 'draw' | null;
    winningLines: WinningLine[];
}

type LocalAction =
    | { type: 'MARK'; face: number; row: number; col: number }
    | { type: 'ROTATE'; move: Move }
    | { type: 'RESET' };

function freshState(): LocalState {
    return {
        marks: initialMarks(),
        currentTurn: 'X',
        moveCount: 0,
        winner: null,
        winningLines: [],
    };
}

function reducer(state: LocalState, action: LocalAction): LocalState {
    if (action.type === 'RESET') {
        return freshState();
    }

    if (state.winner !== null) {
        return state; // game over, ignore moves
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
        // Current player wins (even if only opponent line exists, per rule).
        const mine = allLines.filter((l) => l.player === state.currentTurn);
        return {
            marks: newMarks,
            currentTurn: state.currentTurn,
            moveCount: nextCount,
            winner: state.currentTurn,
            winningLines: mine.length > 0 ? mine : allLines,
        };
    }

    if (nextCount >= MOVE_LIMIT || isComplete(newMarks)) {
        return {
            marks: newMarks,
            currentTurn: state.currentTurn,
            moveCount: nextCount,
            winner: 'draw',
            winningLines: [],
        };
    }

    return {
        marks: newMarks,
        currentTurn: state.currentTurn === 'X' ? 'O' : 'X',
        moveCount: nextCount,
        winner: null,
        winningLines: [],
    };
}

export default function LocalGame() {
    const [state, dispatch] = useReducer(reducer, undefined, freshState);
    const cubeRef = useRef<CubeSceneHandle>(null);

    const playerX = { id: null, nickname: 'Player 1', avatar_color: '#ff4d2e' };
    const playerO = { id: null, nickname: 'Player 2', avatar_color: '#3a90ff' };

    const handleMark = (face: number, row: number, col: number) => {
        dispatch({ type: 'MARK', face, row, col });
    };
    const handleRotate = (move: Move) => {
        // Queue the visual animation first so CubeScene's `isAnimatingRef`
        // is set before the dispatch-driven marks prop update propagates.
        cubeRef.current?.playMove(move);
        dispatch({ type: 'ROTATE', move });
    };
    const handleReset = () => {
        dispatch({ type: 'RESET' });
    };
    const handleLeave = () => {
        router.get(route('games.show', 'cubetac'));
    };

    return (
        <GameLayout fullHeight={true}>
            <Head title="CubeTac — Local" />

            <div className="relative flex h-full flex-col">
                {state.winner === null ? (
                    <PlayingPhase
                        cubeRef={cubeRef}
                        marks={state.marks}
                        currentTurn={state.currentTurn}
                        moveCount={state.moveCount}
                        moveLimit={MOVE_LIMIT}
                        xPlayer={playerX}
                        oPlayer={playerO}
                        mySymbol={null}
                        isMyTurn={true}
                        onMark={handleMark}
                        onRotate={handleRotate}
                        turnLabelOverride={`${state.currentTurn === 'X' ? 'Player 1' : 'Player 2'}'s Turn`}
                        onLeave={handleLeave}
                    />
                ) : (
                    <FinishedPhase
                        marks={state.marks}
                        winner={state.winner}
                        winningLines={state.winningLines}
                        xPlayer={playerX}
                        oPlayer={playerO}
                        mySymbol={null}
                        canRematch={true}
                        onRematch={handleReset}
                        onLeave={handleLeave}
                        leaveLabel="Main menu"
                    />
                )}
            </div>

        </GameLayout>
    );
}
