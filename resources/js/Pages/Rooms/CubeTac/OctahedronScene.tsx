/**
 * 3D octahedron renderer for the CubeTac "Octahedron" variant.
 *
 * Same 9-cell triangular faces as the Pyraminx, on 8 faces. Rotations come
 * from the parent's `OctaRotateControls`. Rendering, rotation and feedback
 * live in `PolyhedronScene`.
 */

import { forwardRef } from 'react';
import * as octahedron from '@/lib/octahedron';
import PolyhedronScene, {
    type CellClickHandler,
    type PolyhedronConfig,
    type PolyhedronSceneHandle,
    type PolyhedronSceneProps,
    type RotateHandler,
} from './PolyhedronScene';

/** A pleasantly distinct color per face — 8 pastels, one per octahedron face. */
const FACE_COLORS: string[] = [
    '#fde68a', // amber-200 (yellow)
    '#fca5a5', // red-300
    '#cbd5e1', // slate-300 (gray)
    '#bbf7d0', // green-200
    '#bfdbfe', // blue-200
    '#fed7aa', // orange-200
    '#a5f3fc', // cyan-200
    '#fbcfe8', // pink-200
];

const CONFIG: PolyhedronConfig = {
    geometry: octahedron,
    faceColors: FACE_COLORS,
    isPlayableSlot: octahedron.isPlayable,
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

export type OctaCellClickHandler = CellClickHandler;
export type OctaRotateHandler = RotateHandler;
export type OctahedronSceneHandle = PolyhedronSceneHandle;

const OctahedronScene = forwardRef<OctahedronSceneHandle, PolyhedronSceneProps>(function OctahedronScene(props, ref) {
    return <PolyhedronScene ref={ref} config={CONFIG} {...props} />;
});

export default OctahedronScene;
