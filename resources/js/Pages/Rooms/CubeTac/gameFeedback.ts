/**
 * Non-visual helpers shared by the online page, the local hotseat boards and
 * the play/finish phases: win-line normalisation, the end-of-game reveal
 * delay, and haptics.
 */

import { useEffect, useState } from 'react';
import { indexOf } from '@/lib/rubikCube';
import type { WinningLineData } from './FinishedPhase';
import type { SceneViewHandle } from './sceneInteraction';

/**
 * Flattens winning lines to flat sticker indices. Cube lines carry
 * `[row, col]` pairs on `line.face`; every other variant already sends flat
 * indices.
 */
export function toIndexGroups(lines: WinningLineData[]): number[][] {
    return lines.map((line) =>
        line.cells.map((cell) => (Array.isArray(cell) ? indexOf(line.face, cell[0], cell[1]) : cell)),
    );
}

/** How long the winning line stays on the live board before the results screen. */
const REVEAL_HOLD_MS = 1600;

/**
 * Returns true once the finished screen should replace the live board.
 * When the game ends mid-play we first let any rotation finish, then hold
 * on the board (with the win line drawn) for a beat. A page that loads an
 * already-finished game skips straight to the results.
 */
export function useFinishReveal(finished: boolean, getHandle: () => SceneViewHandle | null | undefined): boolean {
    const [showFinished, setShowFinished] = useState(finished);

    useEffect(() => {
        if (!finished) {
            setShowFinished(false);
            return;
        }
        if (showFinished) return;
        let cancelled = false;
        const idle = getHandle()?.idle() ?? Promise.resolve();
        idle.then(() => {
            window.setTimeout(() => {
                if (!cancelled) setShowFinished(true);
            }, REVEAL_HOLD_MS);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finished]);

    return showFinished;
}

export function vibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
    }
}
