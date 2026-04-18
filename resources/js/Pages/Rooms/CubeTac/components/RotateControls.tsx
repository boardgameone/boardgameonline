/**
 * Rotate-face control panel.
 *
 * Each face of the cube is labeled on the 3D view (TOP / BOT / LEFT /
 * RIGHT / FRONT / BACK) and each button here maps 1-to-1 to those labels
 * plus a direction (↻ clockwise, ↺ counter-clockwise). Buttons are fully
 * filled with the face's color so a player can instantly match "the teal
 * TOP button rotates the teal TOP face" without reading the label.
 */

import { Move } from '@/lib/rubikCube';

interface RotateControlsProps {
    onRotate: (move: Move) => void;
    disabled: boolean;
}

interface FaceConfig {
    name: string;
    cw: Move;
    ccw: Move;
    /** Full-color tint set. All Tailwind v4 classes; no dynamic class synthesis. */
    tint: {
        /** Saturated button fill. */
        bg: string;
        /** One shade darker for hover. */
        hoverBg: string;
        /** Label pill background (tinted-light). */
        labelBg: string;
        /** Label text color — matches the face hue but dark enough to read. */
        labelText: string;
        /** Focus ring color. */
        ring: string;
    };
}

const FACES: FaceConfig[] = [
    {
        name: 'TOP',
        cw: 'U',
        ccw: "U'",
        tint: {
            bg: 'bg-teal-500',
            hoverBg: 'hover:bg-teal-600',
            labelBg: 'bg-teal-100',
            labelText: 'text-teal-800',
            ring: 'focus-visible:ring-teal-400',
        },
    },
    {
        name: 'BOT',
        cw: 'D',
        ccw: "D'",
        tint: {
            bg: 'bg-purple-500',
            hoverBg: 'hover:bg-purple-600',
            labelBg: 'bg-purple-100',
            labelText: 'text-purple-800',
            ring: 'focus-visible:ring-purple-400',
        },
    },
    {
        name: 'LEFT',
        cw: 'L',
        ccw: "L'",
        tint: {
            bg: 'bg-emerald-500',
            hoverBg: 'hover:bg-emerald-600',
            labelBg: 'bg-emerald-100',
            labelText: 'text-emerald-800',
            ring: 'focus-visible:ring-emerald-400',
        },
    },
    {
        name: 'RIGHT',
        cw: 'R',
        ccw: "R'",
        tint: {
            bg: 'bg-sky-500',
            hoverBg: 'hover:bg-sky-600',
            labelBg: 'bg-sky-100',
            labelText: 'text-sky-800',
            ring: 'focus-visible:ring-sky-400',
        },
    },
    {
        name: 'FRONT',
        cw: 'F',
        ccw: "F'",
        tint: {
            bg: 'bg-pink-500',
            hoverBg: 'hover:bg-pink-600',
            labelBg: 'bg-pink-100',
            labelText: 'text-pink-800',
            ring: 'focus-visible:ring-pink-400',
        },
    },
    {
        name: 'BACK',
        cw: 'B',
        ccw: "B'",
        tint: {
            bg: 'bg-amber-500',
            hoverBg: 'hover:bg-amber-600',
            labelBg: 'bg-amber-100',
            labelText: 'text-amber-900',
            ring: 'focus-visible:ring-amber-400',
        },
    },
];

export default function RotateControls({ onRotate, disabled }: RotateControlsProps) {
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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {FACES.map((face) => (
                    <div key={face.name} className="flex flex-col items-center gap-1">
                        <div
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${face.tint.labelBg} ${face.tint.labelText}`}
                        >
                            {face.name}
                        </div>
                        <div className="flex gap-1">
                            <RotateButton
                                face={face}
                                move={face.cw}
                                direction="cw"
                                onClick={() => onRotate(face.cw)}
                                disabled={disabled}
                            />
                            <RotateButton
                                face={face}
                                move={face.ccw}
                                direction="ccw"
                                onClick={() => onRotate(face.ccw)}
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
    move: Move;
    direction: 'cw' | 'ccw';
    onClick: () => void;
    disabled: boolean;
}

function RotateButton({ face, move, direction, onClick, disabled }: RotateButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={`Rotate ${face.name} ${direction === 'cw' ? 'clockwise' : 'counter-clockwise'} (${move})`}
            title={`${face.name} ${direction === 'cw' ? 'clockwise' : 'counter-clockwise'}`}
            className={`group grid h-11 w-11 place-items-center rounded-lg text-white transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 sm:h-12 sm:w-12 ${
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

// -----------------------------------------------------------------------------
// Rotation direction icons
// -----------------------------------------------------------------------------

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
