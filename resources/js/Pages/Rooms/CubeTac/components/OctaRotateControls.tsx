/**
 * Rotate-face control panel for the Octahedron variant.
 *
 * The octahedron has 8 faces; each gets a CW/CCW button pair, matching
 * the face colors used by the 3D scene so a player can match "the yellow
 * pair rotates the yellow face". A 9-cell triangular face has no
 * fixed-point cell under 120° rotation, so unlike the Megaminx we expose
 * rotation through this external panel rather than a center-tap button.
 */

import { useEffect } from 'react';

import { Direction } from '@/lib/octahedron';

interface OctaRotateControlsProps {
    onRotate: (face: number, direction: Direction) => void;
    disabled: boolean;
}

interface FaceConfig {
    name: string;
    /** Index 0..7 matching `octahedron.ts` faces. */
    index: number;
    tint: {
        bg: string;
        hoverBg: string;
        labelBg: string;
        labelText: string;
        ring: string;
    };
}

const FACES: FaceConfig[] = [
    {
        name: 'Yellow',
        index: 0,
        tint: {
            bg: 'bg-amber-400',
            hoverBg: 'hover:bg-amber-500',
            labelBg: 'bg-amber-100',
            labelText: 'text-amber-800',
            ring: 'focus-visible:ring-amber-400',
        },
    },
    {
        name: 'Red',
        index: 1,
        tint: {
            bg: 'bg-red-400',
            hoverBg: 'hover:bg-red-500',
            labelBg: 'bg-red-100',
            labelText: 'text-red-800',
            ring: 'focus-visible:ring-red-400',
        },
    },
    {
        name: 'Gray',
        index: 2,
        tint: {
            bg: 'bg-slate-400',
            hoverBg: 'hover:bg-slate-500',
            labelBg: 'bg-slate-100',
            labelText: 'text-slate-800',
            ring: 'focus-visible:ring-slate-400',
        },
    },
    {
        name: 'Green',
        index: 3,
        tint: {
            bg: 'bg-emerald-400',
            hoverBg: 'hover:bg-emerald-500',
            labelBg: 'bg-emerald-100',
            labelText: 'text-emerald-800',
            ring: 'focus-visible:ring-emerald-400',
        },
    },
    {
        name: 'Blue',
        index: 4,
        tint: {
            bg: 'bg-blue-400',
            hoverBg: 'hover:bg-blue-500',
            labelBg: 'bg-blue-100',
            labelText: 'text-blue-800',
            ring: 'focus-visible:ring-blue-400',
        },
    },
    {
        name: 'Orange',
        index: 5,
        tint: {
            bg: 'bg-orange-400',
            hoverBg: 'hover:bg-orange-500',
            labelBg: 'bg-orange-100',
            labelText: 'text-orange-800',
            ring: 'focus-visible:ring-orange-400',
        },
    },
    {
        name: 'Cyan',
        index: 6,
        tint: {
            bg: 'bg-cyan-400',
            hoverBg: 'hover:bg-cyan-500',
            labelBg: 'bg-cyan-100',
            labelText: 'text-cyan-800',
            ring: 'focus-visible:ring-cyan-400',
        },
    },
    {
        name: 'Pink',
        index: 7,
        tint: {
            bg: 'bg-pink-400',
            hoverBg: 'hover:bg-pink-500',
            labelBg: 'bg-pink-100',
            labelText: 'text-pink-800',
            ring: 'focus-visible:ring-pink-400',
        },
    },
];

export default function OctaRotateControls({ onRotate, disabled }: OctaRotateControlsProps) {
    // Keyboard shortcut: 1..8 trigger CW rotation of face 0..7; Shift+1..8 CCW.
    useEffect(() => {
        if (disabled) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }
            const digit = Number(e.key);
            if (!Number.isInteger(digit) || digit < 1 || digit > FACES.length) {
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
            <div className="grid grid-cols-4 gap-2">
                {FACES.map((face) => (
                    <div key={face.name} className="flex flex-col items-center gap-1">
                        <div
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wider ${face.tint.labelBg} ${face.tint.labelText}`}
                        >
                            {face.name}
                        </div>
                        <div className="flex gap-1">
                            <RotateButton
                                face={face}
                                direction="cw"
                                onClick={() => onRotate(face.index, 'cw')}
                                disabled={disabled}
                            />
                            <RotateButton
                                face={face}
                                direction="ccw"
                                onClick={() => onRotate(face.index, 'ccw')}
                                disabled={disabled}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface RotateButtonProps {
    face: FaceConfig;
    direction: 'cw' | 'ccw';
    onClick: () => void;
    disabled: boolean;
}

function RotateButton({ face, direction, onClick, disabled }: RotateButtonProps) {
    const shortcut = `${direction === 'ccw' ? 'Shift+' : ''}${face.index + 1}`;
    const directionLabel = direction === 'cw' ? 'clockwise' : 'counter-clockwise';
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={`Rotate ${face.name} face ${directionLabel}`}
            title={`${face.name} ${directionLabel} — ${shortcut}`}
            className={`grid h-11 w-11 place-items-center rounded-lg text-white transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 sm:h-12 sm:w-12 ${
                disabled
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400 shadow-xs'
                    : `${face.tint.bg} ${face.tint.hoverBg} ${face.tint.ring} shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0`
            }`}
        >
            {direction === 'cw' ? (
                <RotateCwIcon className="h-5 w-5" />
            ) : (
                <RotateCcwIcon className="h-5 w-5" />
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
