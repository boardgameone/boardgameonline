/**
 * Rotate-face control panel for the Icosahedron variant.
 *
 * The icosahedron has 20 faces; each gets a CW/CCW button pair labelled with
 * its face index plus a color swatch matching the 3D scene's face color.
 * A 9-cell triangular face has no fixed-point cell under 120° rotation, so
 * unlike the Megaminx we expose rotation through this external panel rather
 * than a center-tap button.
 *
 * Keyboard shortcuts: keys 1..9 trigger CW rotation of faces 0..8;
 * Shift+1..9 CCW. Faces 9..19 (1-indexed: 10..20) stay clickable but have no
 * shortcut, since digit keys can't address a 2-digit index.
 */

import { useEffect } from 'react';

import { Direction } from '@/lib/icosahedron';
import { getFaceColors } from '../IcosahedronScene';

interface IcosaRotateControlsProps {
    onRotate: (face: number, direction: Direction) => void;
    disabled: boolean;
}

const FACE_COUNT = 20;
const SHORTCUT_LIMIT = 9;

export default function IcosaRotateControls({ onRotate, disabled }: IcosaRotateControlsProps) {
    const colors = getFaceColors();

    // Keyboard shortcut: keys 1..9 trigger CW rotation of face 0..8;
    // Shift+1..9 CCW. Faces 9..19 have no hotkey (10+ would need 2 digits).
    useEffect(() => {
        if (disabled) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }
            const digit = Number(e.key);
            if (!Number.isInteger(digit) || digit < 1 || digit > SHORTCUT_LIMIT) {
                return;
            }
            const target = e.target as HTMLElement | null;
            if (
                target?.tagName === 'INPUT'
                || target?.tagName === 'TEXTAREA'
                || target?.isContentEditable
            ) {
                return;
            }
            e.preventDefault();
            onRotate(digit - 1, e.shiftKey ? 'ccw' : 'cw');
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onRotate, disabled]);

    return (
        <div className="flex w-full flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">
                <span>Rotate a face</span>
                <span className="text-gray-400">·</span>
                <span className="inline-flex items-center gap-1">
                    <RotateCwIcon className="h-3 w-3" /> cw
                </span>
                <span className="text-gray-300">/</span>
                <span className="inline-flex items-center gap-1">
                    <RotateCcwIcon className="h-3 w-3" /> ccw
                </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {Array.from({ length: FACE_COUNT }, (_, faceIndex) => {
                    const color = colors[faceIndex] ?? '#94a3b8';
                    return (
                        <div key={faceIndex} className="flex flex-col items-center gap-1">
                            <div
                                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-black tracking-wider text-gray-700 shadow-xs ring-1 ring-gray-200"
                            >
                                <span
                                    className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-gray-300"
                                    style={{ backgroundColor: color }}
                                    aria-hidden="true"
                                />
                                Face {faceIndex + 1}
                            </div>
                            <div className="flex gap-1">
                                <RotateButton
                                    faceIndex={faceIndex}
                                    color={color}
                                    direction="cw"
                                    onClick={() => onRotate(faceIndex, 'cw')}
                                    disabled={disabled}
                                />
                                <RotateButton
                                    faceIndex={faceIndex}
                                    color={color}
                                    direction="ccw"
                                    onClick={() => onRotate(faceIndex, 'ccw')}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface RotateButtonProps {
    faceIndex: number;
    color: string;
    direction: 'cw' | 'ccw';
    onClick: () => void;
    disabled: boolean;
}

function RotateButton({ faceIndex, color, direction, onClick, disabled }: RotateButtonProps) {
    const hasShortcut = faceIndex < SHORTCUT_LIMIT;
    const shortcut = hasShortcut
        ? `${direction === 'ccw' ? 'Shift+' : ''}${faceIndex + 1}`
        : null;
    const directionLabel = direction === 'cw' ? 'clockwise' : 'counter-clockwise';
    const titleSuffix = shortcut ? ` — ${shortcut}` : '';
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={`Rotate face ${faceIndex + 1} ${directionLabel}`}
            title={`Face ${faceIndex + 1} ${directionLabel}${titleSuffix}`}
            className={`grid h-9 w-9 place-items-center rounded-lg text-gray-900 transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-500 sm:h-10 sm:w-10 ${
                disabled
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400 shadow-xs'
                    : 'shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0'
            }`}
            style={!disabled ? { backgroundColor: color } : undefined}
        >
            {direction === 'cw' ? (
                <RotateCwIcon className="h-4 w-4" />
            ) : (
                <RotateCcwIcon className="h-4 w-4" />
            )}
        </button>
    );
}

function RotateCwIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3.8-7.3" />
            <path d="M21 4v5h-5" />
        </svg>
    );
}

function RotateCcwIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3.8-7.3" />
            <path d="M3 4v5h5" />
        </svg>
    );
}
