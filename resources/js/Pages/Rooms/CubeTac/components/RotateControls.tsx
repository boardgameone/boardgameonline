/**
 * Rotate-face control panel.
 *
 * Each face of the cube is labeled on the 3D view (TOP / BOT / LEFT /
 * RIGHT / FRONT / BACK) and each button here maps 1-to-1 to those labels
 * plus a direction (↻ clockwise, ↺ counter-clockwise). Color-coding is
 * shared with the cube face labels so a player can instantly find "the
 * teal TOP button rotates the teal-labeled TOP face".
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
    tint: {
        border: string;
        activeBorder: string;
        text: string;
        dot: string;
        hoverBg: string;
        ring: string;
    };
}

const FACES: FaceConfig[] = [
    {
        name: 'TOP',
        cw: 'U',
        ccw: "U'",
        tint: {
            border: 'border-teal-300',
            activeBorder: 'hover:border-teal-500',
            text: 'text-teal-800',
            dot: 'bg-teal-400',
            hoverBg: 'hover:bg-teal-50',
            ring: 'ring-teal-200',
        },
    },
    {
        name: 'BOT',
        cw: 'D',
        ccw: "D'",
        tint: {
            border: 'border-purple-300',
            activeBorder: 'hover:border-purple-500',
            text: 'text-purple-800',
            dot: 'bg-purple-400',
            hoverBg: 'hover:bg-purple-50',
            ring: 'ring-purple-200',
        },
    },
    {
        name: 'LEFT',
        cw: 'L',
        ccw: "L'",
        tint: {
            border: 'border-emerald-300',
            activeBorder: 'hover:border-emerald-500',
            text: 'text-emerald-800',
            dot: 'bg-emerald-400',
            hoverBg: 'hover:bg-emerald-50',
            ring: 'ring-emerald-200',
        },
    },
    {
        name: 'RIGHT',
        cw: 'R',
        ccw: "R'",
        tint: {
            border: 'border-sky-300',
            activeBorder: 'hover:border-sky-500',
            text: 'text-sky-800',
            dot: 'bg-sky-400',
            hoverBg: 'hover:bg-sky-50',
            ring: 'ring-sky-200',
        },
    },
    {
        name: 'FRONT',
        cw: 'F',
        ccw: "F'",
        tint: {
            border: 'border-pink-300',
            activeBorder: 'hover:border-pink-500',
            text: 'text-pink-800',
            dot: 'bg-pink-400',
            hoverBg: 'hover:bg-pink-50',
            ring: 'ring-pink-200',
        },
    },
    {
        name: 'BACK',
        cw: 'B',
        ccw: "B'",
        tint: {
            border: 'border-amber-300',
            activeBorder: 'hover:border-amber-500',
            text: 'text-amber-800',
            dot: 'bg-amber-400',
            hoverBg: 'hover:bg-amber-50',
            ring: 'ring-amber-200',
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
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-600">
                            <span className={`h-1.5 w-1.5 rounded-full ${face.tint.dot}`} />
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
            className={`group grid h-11 w-11 place-items-center rounded-lg border-2 bg-white transition-all duration-150 sm:h-12 sm:w-12 ${
                disabled
                    ? 'cursor-not-allowed border-gray-200 bg-gray-100/60 text-gray-300'
                    : `${face.tint.border} ${face.tint.activeBorder} ${face.tint.hoverBg} ${face.tint.text} shadow-sm hover:shadow-md active:scale-95`
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
