/**
 * 3D icosahedron renderer for the CubeTac "Icosahedron" variant.
 *
 * Same 9-cell triangular faces as the Pyraminx, on 20 faces. Rotations come
 * from the parent's `IcosaRotateControls`. Rendering, rotation and feedback
 * live in `PolyhedronScene`.
 */

import { forwardRef } from 'react';
import * as icosahedron from '@/lib/icosahedron';
import PolyhedronScene, {
    type CellClickHandler,
    type PolyhedronConfig,
    type PolyhedronSceneHandle,
    type PolyhedronSceneProps,
    type RotateHandler,
} from './PolyhedronScene';

/**
 * 20 distinct pastel face colors. The first 12 mirror MegaminxScene's palette
 * for visual continuity; the trailing 8 are additional pastels with good
 * contrast against neighbors so adjacent faces never collide.
 */
const FACE_COLORS: string[] = [
    '#fde68a', // amber-200
    '#fca5a5', // red-300
    '#bbf7d0', // green-200
    '#bfdbfe', // blue-200
    '#ddd6fe', // violet-200
    '#fbcfe8', // pink-200
    '#a5f3fc', // cyan-200
    '#fed7aa', // orange-200
    '#d9f99d', // lime-200
    '#cbd5e1', // slate-300
    '#fef3c7', // yellow-100
    '#e9d5ff', // purple-200
    // 8 additional pastels for icosahedron's 20 faces:
    '#fda4af', // salmon (rose-300)
    '#c4b5fd', // lavender (violet-300)
    '#a7f3d0', // mint (emerald-200)
    '#99f6e4', // teal (teal-200)
    '#fef9c3', // cream (yellow-100 lighter)
    '#c7d2fe', // periwinkle (indigo-200)
    '#fecdd3', // peach-rose (rose-200)
    '#fb923c', // coral (orange-400 — pop accent)
];

const CONFIG: PolyhedronConfig = {
    geometry: icosahedron,
    faceColors: FACE_COLORS,
    isPlayableSlot: icosahedron.isPlayable,
    deadSlotColor: '#64748b',
    camera: { position: [3.0, 2.4, 3.2], fov: 45 },
    minDistance: 2.6,
    maxDistance: 7,
    animationMs: 240,
    tileLift: 0.014,
    glyphLift: 0.022,
    glyphScale: 1.05,
    centerButtons: false,
};

export type IcosaCellClickHandler = CellClickHandler;
export type IcosaRotateHandler = RotateHandler;
export type IcosahedronSceneHandle = PolyhedronSceneHandle;

const IcosahedronScene = forwardRef<IcosahedronSceneHandle, PolyhedronSceneProps>(function IcosahedronScene(props, ref) {
    return <PolyhedronScene ref={ref} config={CONFIG} {...props} />;
});

export default IcosahedronScene;

/** Public accessor for the rotate-controls panel — each face button shows a
 *  matching color swatch so a player can pair "the salmon button rotates the
 *  salmon face". */
export function getFaceColors(): string[] {
    return FACE_COLORS;
}
