/**
 * 3D dodecahedron renderer for the CubeTac "Megaminx" variant.
 *
 * Each pentagonal face has 11 pieces (center + 5 corners + 5 edges); the
 * center is never markable and carries the ↺ / ↻ rotate button.
 * Rendering, rotation and feedback live in `PolyhedronScene`.
 */

import { forwardRef } from 'react';
import * as megaminx from '@/lib/megaminx';
import PolyhedronScene, {
    type CellClickHandler,
    type PolyhedronConfig,
    type PolyhedronSceneHandle,
    type PolyhedronSceneProps,
    type RotateHandler,
} from './PolyhedronScene';

/** A pleasantly distinct color per face — used for the pentagon backdrops. */
const FACE_COLORS: string[] = [
    '#fde68a', // amber-200 (top, U-ish)
    '#fda4af', // rose-300
    '#a7f3d0', // emerald-200
    '#bae6fd', // sky-200
    '#ddd6fe', // violet-200
    '#fed7aa', // orange-200
    '#bbf7d0', // green-200
    '#fbcfe8', // pink-200
    '#c7d2fe', // indigo-200
    '#fef08a', // yellow-200
    '#a5f3fc', // cyan-200
    '#e9d5ff', // purple-200
];

const CONFIG: PolyhedronConfig = {
    geometry: megaminx,
    faceColors: FACE_COLORS,
    isPlayableSlot: (slot) => !megaminx.isCenterSlot(slot),
    deadSlotColor: 'face',
    camera: { position: [0, 0, 6.2], fov: 38 },
    minDistance: 4.2,
    maxDistance: 9,
    animationMs: 220,
    tileLift: 0.018,
    glyphLift: 0.025,
    glyphScale: 1.3,
    centerButtons: true,
};

export type MegaCellClickHandler = CellClickHandler;
export type MegaRotateHandler = RotateHandler;
export type MegaminxSceneHandle = PolyhedronSceneHandle;

const MegaminxScene = forwardRef<MegaminxSceneHandle, PolyhedronSceneProps>(function MegaminxScene(props, ref) {
    return <PolyhedronScene ref={ref} config={CONFIG} {...props} />;
});

export default MegaminxScene;
