/**
 * 3D tetrahedron renderer for the CubeTac "Pyraminx" variant.
 *
 * Each triangular face has 9 cells: 6 playable up-triangles and 3 dead
 * down-triangles drawn as slate grout. Rotations come from the parent's
 * `PyraRotateControls`. Rendering, rotation and feedback live in `PolyhedronScene`.
 */

import { forwardRef } from 'react';
import * as pyraminx from '@/lib/pyraminx';
import PolyhedronScene, {
    type CellClickHandler,
    type PolyhedronConfig,
    type PolyhedronSceneHandle,
    type PolyhedronSceneProps,
    type RotateHandler,
} from './PolyhedronScene';

/** A pleasantly distinct color per face — matches the photo's yellow/red/gray/green. */
const FACE_COLORS: string[] = [
    '#fde68a', // amber-200 (yellow)
    '#fca5a5', // red-300
    '#cbd5e1', // slate-300 (gray)
    '#bbf7d0', // green-200
];

const CONFIG: PolyhedronConfig = {
    geometry: pyraminx,
    faceColors: FACE_COLORS,
    isPlayableSlot: pyraminx.isPlayable,
    deadSlotColor: '#64748b',
    camera: { position: [2.4, 2.0, 2.6], fov: 45 },
    minDistance: 2.2,
    maxDistance: 6,
    animationMs: 240,
    tileLift: 0.014,
    glyphLift: 0.022,
    glyphScale: 1.05,
    centerButtons: false,
};

export type PyraCellClickHandler = CellClickHandler;
export type PyraRotateHandler = RotateHandler;
export type PyraminxSceneHandle = PolyhedronSceneHandle;

const PyraminxScene = forwardRef<PyraminxSceneHandle, PolyhedronSceneProps>(function PyraminxScene(props, ref) {
    return <PolyhedronScene ref={ref} config={CONFIG} {...props} />;
});

export default PyraminxScene;
