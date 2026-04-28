/**
 * Single source of truth for the cube's per-face palette. Both the rotation
 * buttons (RotateControls.tsx) and the 3D scene (CubeScene.tsx) consume these
 * values so a player can visually correlate "the teal Up button" with "the
 * teal-rimmed Up face" of the cube.
 *
 * Hex values are picked to match the Tailwind v4 `*-500` shades used in the
 * RotateControls button fills.
 */

export const FACE_COLORS = {
    /** Up — teal-500 */
    U: '#14b8a6',
    /** Down — purple-500 */
    D: '#a855f7',
    /** Left — emerald-500 */
    L: '#10b981',
    /** Right — sky-500 */
    R: '#0ea5e9',
    /** Front — pink-500 */
    F: '#ec4899',
    /** Peeché (back) — amber-500 */
    P: '#f59e0b',
} as const;

export type FaceKey = keyof typeof FACE_COLORS;

export const FACE_NAMES: Record<FaceKey, string> = {
    U: 'Up',
    D: 'Down',
    L: 'Left',
    R: 'Right',
    F: 'Front',
    P: 'Peeché',
};

/** RubikCube face indices map: 0=U, 1=D, 2=L, 3=R, 4=F, 5=B(=Peeché). */
export const FACE_KEY_BY_INDEX: FaceKey[] = ['U', 'D', 'L', 'R', 'F', 'P'];

export function faceColorByIndex(face: number): string {
    const key = FACE_KEY_BY_INDEX[face];
    return key ? FACE_COLORS[key] : '#5b9bd5';
}
