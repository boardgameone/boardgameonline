/**
 * Slowly spinning, drag-to-inspect 3D preview of a CubeTac playing surface,
 * shown on the local-match setup screen and in the online lobby. Each
 * variant gets a fixed demo position — a few marks from three players and
 * one finished line — so newcomers can see what a win looks like.
 */

import { Suspense, lazy, useMemo } from 'react';
import { indexOf as cubeIndexOf, lines as cubeLines } from '@/lib/rubikCube';
import { lines as megaLines } from '@/lib/megaminx';
import { lines as pyraLines } from '@/lib/pyraminx';
import { lines as octaLines } from '@/lib/octahedron';
import { lines as icosaLines } from '@/lib/icosahedron';
import { type CubeTacVariant, variantInfo } from './VariantPicker';

const CubeScene = lazy(() => import('../CubeScene'));
const MegaminxScene = lazy(() => import('../MegaminxScene'));
const PyraminxScene = lazy(() => import('../PyraminxScene'));
const OctahedronScene = lazy(() => import('../OctahedronScene'));
const IcosahedronScene = lazy(() => import('../IcosahedronScene'));

const DEMO_COLORS = ['#ff4d2e', '#3a90ff', '#16a34a'];
const DEMO_DESIGNS = [0, 1, 2];

/** Every line of a variant as flat indices. */
function allLines(variant: CubeTacVariant): number[][] {
    switch (variant) {
        case 'megaminx': return megaLines();
        case 'pyraminx': return pyraLines();
        case 'octahedron': return octaLines();
        case 'icosahedron': return icosaLines();
        default: return cubeLines().map((line) => line.cells.map(([r, c]) => cubeIndexOf(line.face, r, c)));
    }
}

const TOTAL_CELLS: Record<CubeTacVariant, number> = {
    cube: 54,
    megaminx: 132,
    pyraminx: 36,
    octahedron: 72,
    icosahedron: 180,
};

/**
 * Deterministic demo board: player 0 owns one line, and players 1 and 2
 * are scattered over roughly a fifth of the other playable cells.
 */
function demoBoard(variant: CubeTacVariant): { marks: Array<number | null>; winLine: number[] } {
    const lines = allLines(variant);
    // For the cube, use the Front face's middle row so it faces the camera.
    const winLine = variant === 'cube' ? lines[4 * 8 + 1] : lines[0];
    const playable = [...new Set(lines.flat())].sort((a, b) => a - b);
    const marks: Array<number | null> = new Array(TOTAL_CELLS[variant]).fill(null);
    for (const idx of winLine) marks[idx] = 0;

    let seed = 7;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    for (const idx of playable) {
        if (marks[idx] !== null) continue;
        const r = rand();
        if (r < 0.1) marks[idx] = 1;
        else if (r < 0.2) marks[idx] = 2;
        else if (r < 0.24) marks[idx] = 0;
    }
    return { marks, winLine };
}

interface VariantPreviewProps {
    variant: CubeTacVariant;
    className?: string;
}

export default function VariantPreview({ variant, className = '' }: VariantPreviewProps) {
    const { marks, winLine } = useMemo(() => demoBoard(variant), [variant]);
    const info = variantInfo(variant);
    const sceneProps = {
        marks,
        playerColors: DEMO_COLORS,
        designs: DEMO_DESIGNS,
        winningIndices: new Set(winLine),
        winLines: [winLine],
        interactive: false,
        autoRotate: true,
    };

    return (
        <div className={`relative flex flex-col items-center ${className}`}>
            <div className="relative h-full w-full">
                <div
                    className="pointer-events-none absolute inset-x-[15%] bottom-[8%] top-[20%] rounded-full bg-white/40 blur-3xl dark:bg-orange-300/10"
                    aria-hidden="true"
                />
                <Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center">
                            <div className="h-32 w-32 animate-pulse rounded-3xl bg-white/50 shadow-inner dark:bg-white/10" />
                        </div>
                    }
                >
                    <div key={variant} className="h-full w-full cursor-grab motion-safe:animate-scaleIn active:cursor-grabbing">
                        {variant === 'megaminx' ? (
                            <MegaminxScene {...sceneProps} />
                        ) : variant === 'pyraminx' ? (
                            <PyraminxScene {...sceneProps} />
                        ) : variant === 'octahedron' ? (
                            <OctahedronScene {...sceneProps} />
                        ) : variant === 'icosahedron' ? (
                            <IcosahedronScene {...sceneProps} />
                        ) : (
                            <CubeScene {...sceneProps} />
                        )}
                    </div>
                </Suspense>
            </div>
            <p className="mt-1 max-w-md px-4 text-center text-xs font-bold text-yellow-900/75 dark:text-yellow-200/75">
                <span className="font-black text-yellow-900 dark:text-yellow-100">{info.name}:</span>{' '}
                {info.blurb} Get 3 in a row on any face — rotations can make or break a line.
            </p>
        </div>
    );
}
