/**
 * Playing-surface picker shared by the local-match setup screen and the
 * online lobby. Each card shows the shape, how many cells and lines it has,
 * and a rough difficulty so players can tell the five surfaces apart
 * before the live preview even loads.
 */

import { lines as cubeLines } from '@/lib/rubikCube';
import { lines as megaLines } from '@/lib/megaminx';
import { lines as pyraLines } from '@/lib/pyraminx';
import { lines as octaLines } from '@/lib/octahedron';
import { lines as icosaLines } from '@/lib/icosahedron';

export type CubeTacVariant = 'cube' | 'megaminx' | 'pyraminx' | 'octahedron' | 'icosahedron';

export interface VariantInfo {
    id: CubeTacVariant;
    name: string;
    faces: number;
    /** Markable cells. */
    cells: number;
    /** Distinct three-in-a-row lines. */
    lines: number;
    /** 1 (gentle) .. 5 (brain-melting). */
    difficulty: number;
    blurb: string;
}

function countCells(lines: number[][]): number {
    return new Set(lines.flat()).size;
}

const cubeLineCount = cubeLines().length;

export const CUBETAC_VARIANTS: VariantInfo[] = [
    {
        id: 'cube',
        name: 'Cube',
        faces: 6,
        cells: 54,
        lines: cubeLineCount,
        difficulty: 1,
        blurb: 'The classic. Rows, columns and diagonals on every face.',
    },
    {
        id: 'megaminx',
        name: 'Megaminx',
        faces: 12,
        cells: countCells(megaLines()),
        lines: megaLines().length,
        difficulty: 4,
        blurb: 'Twelve pentagons. Tap a face center to twist it.',
    },
    {
        id: 'pyraminx',
        name: 'Pyraminx',
        faces: 4,
        cells: countCells(pyraLines()),
        lines: pyraLines().length,
        difficulty: 2,
        blurb: 'Small and sharp. Lines run around each triangle’s rim.',
    },
    {
        id: 'octahedron',
        name: 'Octahedron',
        faces: 8,
        cells: countCells(octaLines()),
        lines: octaLines().length,
        difficulty: 3,
        blurb: 'Eight triangles, twice the angles to watch.',
    },
    {
        id: 'icosahedron',
        name: 'Icosahedron',
        faces: 20,
        cells: countCells(icosaLines()),
        lines: icosaLines().length,
        difficulty: 5,
        blurb: 'Twenty faces. Good luck keeping track.',
    },
];

export function variantInfo(id: CubeTacVariant): VariantInfo {
    return CUBETAC_VARIANTS.find((v) => v.id === id) ?? CUBETAC_VARIANTS[0];
}

interface VariantPickerProps {
    value: CubeTacVariant;
    /** Omit to render read-only (e.g. a guest in the lobby). */
    onChange?: (variant: CubeTacVariant) => void;
}

export default function VariantPicker({ value, onChange }: VariantPickerProps) {
    const readOnly = !onChange;

    return (
        <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Playing surface">
            {CUBETAC_VARIANTS.map((v) => {
                const selected = v.id === value;
                return (
                    <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={readOnly && !selected}
                        onClick={onChange ? () => onChange(v.id) : undefined}
                        className={`group flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-2.5 text-center transition ${
                            selected
                                ? 'border-transparent bg-linear-to-br from-orange-500 to-pink-500 text-white shadow-lg'
                                : 'border-yellow-300 bg-white/85 text-yellow-900 shadow-sm dark:border-yellow-700/50 dark:bg-gray-800/80 dark:text-yellow-200'
                        } ${
                            readOnly
                                ? selected ? 'cursor-default' : 'opacity-50'
                                : selected ? '' : 'hover:-translate-y-0.5 hover:border-yellow-400 hover:shadow-md active:scale-[0.98]'
                        } ${v.id === 'icosahedron' ? 'col-span-2 sm:col-span-1' : ''}`}
                        title={v.blurb}
                    >
                        <ShapeIcon variant={v.id} className={`h-7 w-7 ${selected ? 'text-white' : 'text-orange-500 dark:text-orange-400'}`} />
                        <span className="text-[11px] font-black uppercase tracking-wide">{v.name}</span>
                        <span className={`text-[10px] font-bold ${selected ? 'text-white/85' : 'text-yellow-900/60 dark:text-yellow-200/60'}`}>
                            {v.faces} faces · {v.cells} cells
                        </span>
                        <span className="flex gap-0.5" aria-label={`Difficulty ${v.difficulty} of 5`}>
                            {Array.from({ length: 5 }, (_, i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 w-1.5 rounded-full ${
                                        i < v.difficulty
                                            ? selected ? 'bg-white' : 'bg-orange-500 dark:bg-orange-400'
                                            : selected ? 'bg-white/35' : 'bg-yellow-900/15 dark:bg-yellow-200/20'
                                    }`}
                                />
                            ))}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** Flat line-art silhouette of each surface. */
function ShapeIcon({ variant, className }: { variant: CubeTacVariant; className?: string }) {
    const common = {
        className,
        viewBox: '0 0 32 32',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinejoin: 'round' as const,
        strokeLinecap: 'round' as const,
        'aria-hidden': true,
    };
    switch (variant) {
        case 'cube':
            return (
                <svg {...common}>
                    <path d="M16 3l11 6v14l-11 6-11-6V9z" />
                    <path d="M5 9l11 6 11-6M16 15v14" />
                </svg>
            );
        case 'megaminx':
            return (
                <svg {...common}>
                    <path d="M16 3l12 8.7-4.6 14.3H8.6L4 11.7z" />
                    <path d="M16 9l6 4.4-2.3 7.1h-7.4L10 13.4z" />
                </svg>
            );
        case 'pyraminx':
            return (
                <svg {...common}>
                    <path d="M16 3l12 24H4z" />
                    <path d="M16 3v24M4 27l12-8 12 8" />
                </svg>
            );
        case 'octahedron':
            return (
                <svg {...common}>
                    <path d="M16 2l11 14-11 14L5 16z" />
                    <path d="M5 16h22M16 2l-4 14 4 14M16 2l4 14-4 14" />
                </svg>
            );
        case 'icosahedron':
            return (
                <svg {...common}>
                    <path d="M16 2l12 7v14l-12 7-12-7V9z" />
                    <path d="M16 2l-6 10h12zM10 12l-6 11M22 12l6 11M10 12l6 18 6-18" />
                </svg>
            );
    }
}
