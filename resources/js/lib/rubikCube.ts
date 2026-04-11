/**
 * TypeScript twin of app/Services/RubikCube.php.
 *
 * Same face order, same basis table, same move params, same permutation
 * generator. The generator runs once per page load (memoized) and
 * produces byte-identical tables to the PHP version. The client uses
 * this for:
 *
 *   - Animating rotations locally while waiting for server poll
 *   - Running the Local Multiplayer (hotseat) mode entirely client-side
 *   - Optimistic validation (is sticker empty, is it my turn)
 */

export type Player = 'X' | 'O';
export type Mark = Player | null;
export type Marks = Mark[]; // length 54

export const FACE_U = 0;
export const FACE_D = 1;
export const FACE_L = 2;
export const FACE_R = 3;
export const FACE_F = 4;
export const FACE_B = 5;

export type Face = 0 | 1 | 2 | 3 | 4 | 5;

export const FACE_NAMES: Record<Face, string> = {
    0: 'U',
    1: 'D',
    2: 'L',
    3: 'R',
    4: 'F',
    5: 'B',
};

export const MOVES = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"] as const;
export type Move = (typeof MOVES)[number];

export interface WinningLine {
    face: Face;
    cells: Array<[number, number]>;
    player: Player;
}

export interface LineDef {
    face: Face;
    cells: Array<[number, number]>;
}

/** (face, row, col) → flat sticker index. */
export function indexOf(face: number, row: number, col: number): number {
    return face * 9 + row * 3 + col;
}

/** flat index → [face, row, col] */
export function faceRowCol(index: number): [Face, number, number] {
    return [Math.floor(index / 9) as Face, Math.floor((index % 9) / 3), index % 3];
}

/** Fresh 54-element mark array (all null). */
export function initialMarks(): Marks {
    return new Array<Mark>(54).fill(null);
}

/** Apply a quarter-turn to a marks array, returning a new array. */
export function apply(move: Move, marks: Marks): Marks {
    const perm = permutations()[move];
    if (!perm) throw new Error(`Unknown move: ${move}`);
    const out: Marks = new Array<Mark>(54);
    for (let i = 0; i < 54; i++) {
        out[i] = marks[perm[i]];
    }
    return out;
}

/** All currently winning lines (per-face only, for either player). */
export function winningLines(marks: Marks): WinningLine[] {
    const results: WinningLine[] = [];
    for (const line of lines()) {
        const a = marks[indexOf(line.face, line.cells[0][0], line.cells[0][1])];
        const b = marks[indexOf(line.face, line.cells[1][0], line.cells[1][1])];
        const c = marks[indexOf(line.face, line.cells[2][0], line.cells[2][1])];
        if (a !== null && a === b && b === c) {
            results.push({ face: line.face, cells: line.cells, player: a });
        }
    }
    return results;
}

/** Whether all 54 stickers are marked. */
export function isComplete(marks: Marks): boolean {
    for (const m of marks) if (m === null) return false;
    return true;
}

// -----------------------------------------------------------------------------
// Geometry (internal, memoized)
// -----------------------------------------------------------------------------

type Vec3 = [number, number, number];

let _lines: LineDef[] | null = null;
let _permutations: Record<Move, number[]> | null = null;

export function lines(): LineDef[] {
    if (_lines) return _lines;
    const out: LineDef[] = [];
    for (let face = 0; face < 6; face++) {
        for (let r = 0; r < 3; r++) {
            out.push({ face: face as Face, cells: [[r, 0], [r, 1], [r, 2]] });
        }
        for (let c = 0; c < 3; c++) {
            out.push({ face: face as Face, cells: [[0, c], [1, c], [2, c]] });
        }
        out.push({ face: face as Face, cells: [[0, 0], [1, 1], [2, 2]] });
        out.push({ face: face as Face, cells: [[0, 2], [1, 1], [2, 0]] });
    }
    _lines = out;
    return out;
}

export function permutations(): Record<Move, number[]> {
    if (_permutations) return _permutations;
    _permutations = generatePermutations();
    return _permutations;
}

function generatePermutations(): Record<Move, number[]> {
    const positions: Vec3[] = [];
    const normals: Vec3[] = [];
    for (let i = 0; i < 54; i++) {
        const [f, r, c] = faceRowCol(i);
        positions.push(sticker3D(f, r, c));
        normals.push(faceNormal(f));
    }

    const lookup = new Map<string, number>();
    for (let i = 0; i < 54; i++) {
        lookup.set(positionKey(positions[i], normals[i]), i);
    }

    const result = {} as Record<Move, number[]>;
    for (const [move, { axis, angle }] of Object.entries(moveParams()) as Array<[Move, { axis: Vec3; angle: number }]>) {
        const perm: number[] = [];
        for (let i = 0; i < 54; i++) perm.push(i);

        for (let src = 0; src < 54; src++) {
            const pos = positions[src];
            const along = pos[0] * axis[0] + pos[1] * axis[1] + pos[2] * axis[2];
            if (along < 0.5) continue;

            const newPos = rotateVector(pos, axis, angle);
            const newNormal = rotateVector(normals[src], axis, angle);
            const dst = lookup.get(positionKey(newPos, newNormal));
            if (dst === undefined) {
                throw new Error(`Missing destination for ${move} from src ${src}`);
            }
            perm[dst] = src;
        }
        result[move] = perm;
    }
    return result;
}

export interface MoveParam {
    axis: Vec3;
    angle: number;
}

export function moveParams(): Record<Move, MoveParam> {
    const q = Math.PI / 2;
    return {
        U: { axis: [0, 1, 0], angle: -q },
        "U'": { axis: [0, 1, 0], angle: q },
        D: { axis: [0, -1, 0], angle: -q },
        "D'": { axis: [0, -1, 0], angle: q },
        L: { axis: [-1, 0, 0], angle: -q },
        "L'": { axis: [-1, 0, 0], angle: q },
        R: { axis: [1, 0, 0], angle: -q },
        "R'": { axis: [1, 0, 0], angle: q },
        F: { axis: [0, 0, 1], angle: -q },
        "F'": { axis: [0, 0, 1], angle: q },
        B: { axis: [0, 0, -1], angle: -q },
        "B'": { axis: [0, 0, -1], angle: q },
    };
}

/**
 * Which lattice cubies are in the layer for a given move. Used by the
 * frontend to know which cubies to rotate as a group during animation.
 * Returns positions as [x, y, z] triples, each component ∈ {-1, 0, 1}.
 */
export function layerCubies(move: Move): Vec3[] {
    const { axis } = moveParams()[move];
    const result: Vec3[] = [];
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const along = x * axis[0] + y * axis[1] + z * axis[2];
                if (along >= 0.5) result.push([x, y, z]);
            }
        }
    }
    return result;
}

/**
 * 3D world-space position of a sticker (unit-scale cube at origin, with
 * cubies at integer lattice points).
 */
export function sticker3D(face: number, row: number, col: number): Vec3 {
    const origin = faceOrigin(face);
    const rowAxis = faceRowAxis(face);
    const colAxis = faceColAxis(face);
    return [
        origin[0] + row * rowAxis[0] + col * colAxis[0],
        origin[1] + row * rowAxis[1] + col * colAxis[1],
        origin[2] + row * rowAxis[2] + col * colAxis[2],
    ];
}

export function faceOrigin(face: number): Vec3 {
    switch (face) {
        case FACE_U: return [-1, 1, -1];
        case FACE_D: return [-1, -1, -1];
        case FACE_F: return [-1, 1, 1];
        case FACE_B: return [-1, 1, -1];
        case FACE_L: return [-1, 1, -1];
        case FACE_R: return [1, 1, -1];
        default: throw new Error(`Invalid face ${face}`);
    }
}

export function faceRowAxis(face: number): Vec3 {
    switch (face) {
        case FACE_U:
        case FACE_D:
            return [0, 0, 1];
        case FACE_F:
        case FACE_B:
        case FACE_L:
        case FACE_R:
            return [0, -1, 0];
        default: throw new Error(`Invalid face ${face}`);
    }
}

export function faceColAxis(face: number): Vec3 {
    switch (face) {
        case FACE_U:
        case FACE_D:
        case FACE_F:
        case FACE_B:
            return [1, 0, 0];
        case FACE_L:
        case FACE_R:
            return [0, 0, 1];
        default: throw new Error(`Invalid face ${face}`);
    }
}

export function faceNormal(face: number): Vec3 {
    switch (face) {
        case FACE_U: return [0, 1, 0];
        case FACE_D: return [0, -1, 0];
        case FACE_L: return [-1, 0, 0];
        case FACE_R: return [1, 0, 0];
        case FACE_F: return [0, 0, 1];
        case FACE_B: return [0, 0, -1];
        default: throw new Error(`Invalid face ${face}`);
    }
}

function rotateVector(vec: Vec3, axis: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = vec[0] * axis[0] + vec[1] * axis[1] + vec[2] * axis[2];
    const cross: Vec3 = [
        axis[1] * vec[2] - axis[2] * vec[1],
        axis[2] * vec[0] - axis[0] * vec[2],
        axis[0] * vec[1] - axis[1] * vec[0],
    ];
    return [
        vec[0] * cos + cross[0] * sin + axis[0] * dot * (1 - cos),
        vec[1] * cos + cross[1] * sin + axis[1] * dot * (1 - cos),
        vec[2] * cos + cross[2] * sin + axis[2] * dot * (1 - cos),
    ];
}

function positionKey(pos: Vec3, normal: Vec3): string {
    return (
        `${Math.round(pos[0])},${Math.round(pos[1])},${Math.round(pos[2])}` +
        `|${Math.round(normal[0])},${Math.round(normal[1])},${Math.round(normal[2])}`
    );
}
