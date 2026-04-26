/**
 * TypeScript twin of app/Services/PyraminxCube.php.
 *
 * Same vertex/face layout, same adjacency, same permutations. Used by the
 * PyraminxScene component to render the 4-face tetrahedron, animate face
 * rotations locally during the round-trip to the server, and look up
 * winning-line cells for highlighting.
 */

export type Player = number;
export type Mark = Player | null;
export type Marks = Mark[]; // length 36

export const FACES = 4;
export const CELLS_PER_FACE = 9;
export const PLAYABLE_PER_FACE = 6;
export const TOTAL_CELLS = 36;

export type Direction = 'cw' | 'ccw';

export interface WinningLine {
    face: number;
    cells: [number, number, number];
    player: Player;
}

export type Vec3 = [number, number, number];

/** (face, slot) → flat index. */
export function indexOf(face: number, slot: number): number {
    return face * CELLS_PER_FACE + slot;
}

/** flat index → [face, slot] */
export function faceSlot(index: number): [number, number] {
    return [Math.floor(index / CELLS_PER_FACE), index % CELLS_PER_FACE];
}

/** Slots 0..5 are markable up-triangles; slots 6..8 are dead down-triangles. */
export function isPlayable(slot: number): boolean {
    return slot >= 0 && slot <= 5;
}

/** Fresh 36-element mark array (all null). */
export function initialMarks(): Marks {
    return new Array<Mark>(TOTAL_CELLS).fill(null);
}

/** Apply a 120° face rotation (cw or ccw), returning a new marks array. */
export function apply(face: number, direction: Direction, marks: Marks): Marks {
    const perm = permutations()[moveKey(face, direction)];
    if (!perm) throw new Error(`Unknown move: face ${face} ${direction}`);
    const out: Marks = new Array<Mark>(TOTAL_CELLS);
    for (let i = 0; i < TOTAL_CELLS; i++) {
        out[i] = marks[perm[i]];
    }
    return out;
}

/** All currently-winning perimeter triples across all 4 faces. */
export function winningLines(marks: Marks): WinningLine[] {
    const out: WinningLine[] = [];
    for (const line of lines()) {
        const a = marks[line[0]];
        const b = marks[line[1]];
        const c = marks[line[2]];
        if (a !== null && a === b && b === c) {
            out.push({ face: Math.floor(line[0] / CELLS_PER_FACE), cells: line, player: a });
        }
    }
    return out;
}

/** Whether all *playable* cells (down-triangles excluded) are marked. */
export function isComplete(marks: Marks): boolean {
    for (let f = 0; f < FACES; f++) {
        for (let s = 0; s < PLAYABLE_PER_FACE; s++) {
            if (marks[f * CELLS_PER_FACE + s] === null) return false;
        }
    }
    return true;
}

export function moveKey(face: number, direction: Direction): string {
    return `${face}:${direction}`;
}

// ---------------------------------------------------------------------------
// Geometry — memoized
// ---------------------------------------------------------------------------

let _vertices: Vec3[] | null = null;
let _faceCenters: Vec3[] | null = null;
let _faceNormals: Vec3[] | null = null;
let _faceVertices: number[][] | null = null;
let _adjacency: number[][] | null = null;
let _sharedK: number[][] | null = null;
let _lines: Array<[number, number, number]> | null = null;
let _permutations: Record<string, number[]> | null = null;

/** The 4 tetrahedron vertices (alternate corners of a unit cube). */
export function vertices(): Vec3[] {
    if (_vertices) return _vertices;
    _vertices = [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
    ];
    return _vertices;
}

/** Inradius of the tetrahedron with our vertex coords (1/√3 ≈ 0.577). */
export function inradius(): number {
    return 1 / Math.sqrt(3);
}

/**
 * Raw (un-normalized) face-center direction vectors. Each face is opposite
 * a vertex, so its outward normal points in the direction of `-vertex_i`.
 */
function faceCenterDirections(): Vec3[] {
    return vertices().map((v) => [-v[0], -v[1], -v[2]] as Vec3);
}

/** The 4 face center positions (at the inradius along each face normal). */
export function faceCenters(): Vec3[] {
    if (_faceCenters) return _faceCenters;
    const r = inradius();
    _faceCenters = faceCenterDirections().map((d) => {
        const u = normalize(d);
        return [u[0] * r, u[1] * r, u[2] * r] as Vec3;
    });
    return _faceCenters;
}

/** Unit outward normals for the 4 faces. */
export function faceNormals(): Vec3[] {
    if (_faceNormals) return _faceNormals;
    _faceNormals = faceCenterDirections().map(normalize);
    return _faceNormals;
}

/** 3 vertex indices per face, sorted CCW from outside. */
export function faceVertices(): number[][] {
    if (_faceVertices) return _faceVertices;
    computeFaceData();
    return _faceVertices!;
}

/** adjacency[face][edge i] = the face across edge i. */
export function adjacency(): number[][] {
    if (_adjacency) return _adjacency;
    computeFaceData();
    return _adjacency!;
}

/**
 * The precise 9 cell indices on adjacent faces that move when `face`
 * rotates — 3 per adjacent face (2 corners + 1 edge touching F's perimeter).
 * Used to scope the rotation animation so only cells that actually permute
 * are visually rotated.
 */
export function firstRingCells(face: number): number[] {
    computeFaceData();
    const adj = _adjacency!;
    const sk = _sharedK!;
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
        const a = adj[face][i];
        const k = sk[face][i];
        // Per-edge layout (mirror of PyraminxCube::buildFacePermutation):
        out.push(indexOf(a, 2 * k));               // corner at F.v[(i+1)%3]
        out.push(indexOf(a, 2 * k + 1));           // edge on shared edge
        out.push(indexOf(a, 2 * ((k + 1) % 3)));   // corner at F.v[i]
    }
    return out;
}

/** lines[]: 24 triples of cell indices forming winning perimeter lines. */
export function lines(): Array<[number, number, number]> {
    if (_lines) return _lines;
    const out: Array<[number, number, number]> = [];
    for (let f = 0; f < FACES; f++) {
        for (let i = 0; i < PLAYABLE_PER_FACE; i++) {
            out.push([
                indexOf(f, i),
                indexOf(f, (i + 1) % PLAYABLE_PER_FACE),
                indexOf(f, (i + 2) % PLAYABLE_PER_FACE),
            ]);
        }
    }
    _lines = out;
    return out;
}

/** The 6 perimeter slot indices walking the face's boundary (corner-edge alternating). */
export function perimeterRing(): number[] {
    return [0, 1, 2, 3, 4, 5];
}

/** Permutation tables for all 8 moves, keyed by `${face}:${direction}`. */
export function permutations(): Record<string, number[]> {
    if (_permutations) return _permutations;
    computeFaceData();
    const result: Record<string, number[]> = {};
    for (let f = 0; f < FACES; f++) {
        // Vertices are CCW-sorted from outside, so CW visual rotation
        // means the "shift = -1" mapping (vertex i → position of vertex i-1).
        result[moveKey(f, 'cw')] = buildFacePermutation(f, -1);
        result[moveKey(f, 'ccw')] = buildFacePermutation(f, 1);
    }
    _permutations = result;
    return result;
}

/** Per-move animation params: axis (unit) + signed angle (radians). */
export function moveParams(): Record<string, { axis: Vec3; angle: number }> {
    const angle = (2 * Math.PI) / 3;
    const normals = faceNormals();
    const out: Record<string, { axis: Vec3; angle: number }> = {};
    for (let f = 0; f < FACES; f++) {
        // Right-hand rule about an outward normal: positive angle = CCW
        // from the viewer's outside perspective. CW therefore needs a
        // negative angle so the visual matches the user's expectation.
        out[moveKey(f, 'cw')] = { axis: normals[f], angle: -angle };
        out[moveKey(f, 'ccw')] = { axis: normals[f], angle };
    }
    return out;
}

/**
 * Geometry parameters for the Pyraminx face tiling.
 *
 * A face is a flat equilateral triangle split into 9 small triangles in a
 * 1+3+5 row layout. Cells are identified by (row, col) within the face,
 * then mapped to slot indices via the slot-by-vertex/edge convention:
 *   slot 2i     = corner at v[i]                 (i = 0,1,2)
 *   slot 2i+1   = edge on edge[i] (v[i]-v[i+1])  (i = 0,1,2)
 *   slot 6+i    = down-triangle near v[i]        (i = 0,1,2)
 *
 * Slot-to-barycentric centroid mapping (with vertex order v0, v1, v2 from
 * `faceVertices()`):
 *
 *   slot 0  = corner at v0     centroid (8/9, 1/18, 1/18)
 *   slot 1  = edge on v0-v1    centroid (4/9, 4/9,  1/9)
 *   slot 2  = corner at v1     centroid (1/18, 8/9, 1/18)
 *   slot 3  = edge on v1-v2    centroid (1/9,  4/9, 4/9)
 *   slot 4  = corner at v2     centroid (1/18, 1/18, 8/9)
 *   slot 5  = edge on v2-v0    centroid (4/9, 1/9,  4/9)
 *   slot 6  = down "near v0"   centroid (5/9, 2/9,  2/9)
 *   slot 7  = down "near v1"   centroid (2/9, 5/9,  2/9)
 *   slot 8  = down "near v2"   centroid (2/9, 2/9,  5/9)
 *
 * `PIECE_INSET` shrinks each small triangle toward its own centroid by this
 * fraction, leaving thin "grout" gaps between pieces (visible as the dark
 * backdrop showing through).
 */
const PIECE_INSET = 0.06;

/** Apex up-triangle vertices (barycentric) for slot s; output is in ccw order. */
function cellBarycentric(slot: number): [Vec3, Vec3, Vec3] {
    // a + b + c = 1 with values in {0, 1/3, 2/3, 1}.
    const T = 1 / 3;
    const T2 = 2 / 3;
    switch (slot) {
        // Corner at v0 (apex up-triangle, row 0)
        case 0: return [
            [1, 0, 0],
            [T2, T, 0],
            [T2, 0, T],
        ];
        // Edge on v0-v1 (up-triangle, row 1 left)
        case 1: return [
            [T2, T, 0],
            [T, T2, 0],
            [T, T, T],
        ];
        // Corner at v1 (up-triangle, row 2 leftmost)
        case 2: return [
            [T, T2, 0],
            [0, 1, 0],
            [0, T2, T],
        ];
        // Edge on v1-v2 (up-triangle, row 2 middle)
        case 3: return [
            [0, T2, T],
            [0, T, T2],
            [T, T, T],
        ];
        // Corner at v2 (up-triangle, row 2 rightmost)
        case 4: return [
            [0, T, T2],
            [0, 0, 1],
            [T, 0, T2],
        ];
        // Edge on v2-v0 (up-triangle, row 1 right)
        case 5: return [
            [T, T, T],
            [T, 0, T2],
            [T2, 0, T],
        ];
        // Down "near v0" (row 1 middle, points downward)
        case 6: return [
            [T2, T, 0],
            [T, T, T],
            [T2, 0, T],
        ];
        // Down "near v1" (row 2 position 1, points downward)
        case 7: return [
            [T, T2, 0],
            [0, T2, T],
            [T, T, T],
        ];
        // Down "near v2" (row 2 position 3, points downward)
        case 8: return [
            [T, T, T],
            [0, T, T2],
            [T, 0, T2],
        ];
        default:
            throw new Error(`Invalid pyraminx slot: ${slot}`);
    }
}

/**
 * Compute the polygon vertices (in 3D, in the face plane) for a single
 * Pyraminx cell. Returns 3 vertices (each cell is a triangle), already
 * inset by `PIECE_INSET`. CCW order viewed from outside the tetrahedron.
 */
export function cellPolygon(face: number, slot: number): Vec3[] {
    const V = faceVertices()[face].map((vi) => vertices()[vi]);
    const bary = cellBarycentric(slot);
    const raw: Vec3[] = bary.map(([a, b, c]) => [
        a * V[0][0] + b * V[1][0] + c * V[2][0],
        a * V[0][1] + b * V[1][1] + c * V[2][1],
        a * V[0][2] + b * V[1][2] + c * V[2][2],
    ]);
    return insetPolygon(raw, PIECE_INSET);
}

/** Centroid of a cell's polygon — used for placing glyphs. */
export function cellCentroid(face: number, slot: number): Vec3 {
    const poly = cellPolygon(face, slot);
    const n = poly.length;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const v of poly) {
        x += v[0];
        y += v[1];
        z += v[2];
    }
    return [x / n, y / n, z / n];
}

function insetPolygon(verts: Vec3[], factor: number): Vec3[] {
    const n = verts.length;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const v of verts) {
        cx += v[0];
        cy += v[1];
        cz += v[2];
    }
    cx /= n;
    cy /= n;
    cz /= n;
    return verts.map((v) => [
        v[0] + factor * (cx - v[0]),
        v[1] + factor * (cy - v[1]),
        v[2] + factor * (cz - v[2]),
    ] as Vec3);
}

// ---------------------------------------------------------------------------
// Internal: discover face vertex lists, adjacency, and shared-edge mapping.
// ---------------------------------------------------------------------------

function computeFaceData(): void {
    if (_faceVertices && _adjacency && _sharedK) return;

    const verts = vertices();
    const centers = faceCenters();

    const fv: number[][] = [];
    for (let f = 0; f < FACES; f++) {
        const distances: Array<{ idx: number; d: number }> = [];
        for (let v = 0; v < verts.length; v++) {
            distances.push({ idx: v, d: distSq(verts[v], centers[f]) });
        }
        distances.sort((x, y) => x.d - y.d);
        const closest = distances.slice(0, 3).map((x) => x.idx);
        fv.push(sortVerticesCCW(closest, verts, centers[f]));
    }
    _faceVertices = fv;

    const adj: number[][] = [];
    for (let f = 0; f < FACES; f++) {
        adj[f] = [];
        for (let i = 0; i < 3; i++) {
            const vA = fv[f][i];
            const vB = fv[f][(i + 1) % 3];
            let found = -1;
            for (let g = 0; g < FACES; g++) {
                if (g === f) continue;
                if (fv[g].includes(vA) && fv[g].includes(vB)) {
                    found = g;
                    break;
                }
            }
            if (found < 0) throw new Error(`No adjacent face found for face ${f} edge ${i}`);
            adj[f][i] = found;
        }
    }
    _adjacency = adj;

    const sk: number[][] = [];
    for (let f = 0; f < FACES; f++) {
        sk[f] = [];
        for (let i = 0; i < 3; i++) {
            const vA = fv[f][i];
            const vB = fv[f][(i + 1) % 3];
            const a = adj[f][i];
            let foundK = -1;
            for (let k = 0; k < 3; k++) {
                const x = fv[a][k];
                const y = fv[a][(k + 1) % 3];
                if (x === vB && y === vA) {
                    foundK = k;
                    break;
                }
                if (x === vA && y === vB) {
                    throw new Error(
                        `Face ${a} traverses edge (${vA},${vB}) the same way as face ${f}; expected reversed orientation.`,
                    );
                }
            }
            if (foundK < 0) throw new Error(`Adjacent face ${a} missing edge (${vA},${vB})`);
            sk[f][i] = foundK;
        }
    }
    _sharedK = sk;
}

function buildFacePermutation(face: number, shift: number): number[] {
    const adj = _adjacency!;
    const sk = _sharedK!;

    const perm: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) perm.push(i);

    // F's own cells: 3 corner slots, 3 edge slots, 3 down-triangle slots all cycle.
    for (let i = 0; i < 3; i++) {
        const dstV = ((i + shift) % 3 + 3) % 3;
        perm[indexOf(face, 2 * dstV)] = indexOf(face, 2 * i);
        perm[indexOf(face, 2 * dstV + 1)] = indexOf(face, 2 * i + 1);
        perm[indexOf(face, 6 + dstV)] = indexOf(face, 6 + i);
    }

    // First-ring on adjacent faces (3 per adjacent face × 3 adjacents = 9).
    for (let i = 0; i < 3; i++) {
        const dstEdgeIndex = ((i + shift) % 3 + 3) % 3;
        const srcAdj = adj[face][i];
        const dstAdj = adj[face][dstEdgeIndex];
        const srcK = sk[face][i];
        const dstK = sk[face][dstEdgeIndex];

        const srcCornerLeft = 2 * srcK;
        const srcEdgeMid = 2 * srcK + 1;
        const srcCornerRight = 2 * ((srcK + 1) % 3);

        const dstCornerLeft = 2 * dstK;
        const dstEdgeMid = 2 * dstK + 1;
        const dstCornerRight = 2 * ((dstK + 1) % 3);

        perm[indexOf(dstAdj, dstCornerLeft)] = indexOf(srcAdj, srcCornerLeft);
        perm[indexOf(dstAdj, dstEdgeMid)] = indexOf(srcAdj, srcEdgeMid);
        perm[indexOf(dstAdj, dstCornerRight)] = indexOf(srcAdj, srcCornerRight);
    }

    return perm;
}

function sortVerticesCCW(indices: number[], allVerts: Vec3[], center: Vec3): number[] {
    const n = normalize(center);
    const u = anyOrthogonal(n);
    const w = cross(n, u);
    const angles = indices.map((idx) => {
        const v = allVerts[idx];
        const rel: Vec3 = [v[0] - center[0], v[1] - center[1], v[2] - center[2]];
        return { idx, angle: Math.atan2(dot(rel, w), dot(rel, u)) };
    });
    angles.sort((a, b) => a.angle - b.angle);
    return angles.map((a) => a.idx);
}

function normalize(v: Vec3): Vec3 {
    const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (l === 0) throw new Error('zero vector');
    return [v[0] / l, v[1] / l, v[2] / l];
}

function anyOrthogonal(n: Vec3): Vec3 {
    const ref: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return normalize(cross(n, ref));
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function distSq(a: Vec3, b: Vec3): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
}
