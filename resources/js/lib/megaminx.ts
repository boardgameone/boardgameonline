/**
 * TypeScript twin of app/Services/MegaminxCube.php.
 *
 * Same vertex/face layout, same adjacency, same permutations. Used by the
 * MegaminxScene component to render the 12-face dodecahedron, animate face
 * rotations locally during the round-trip to the server, and look up
 * winning-line cells for highlighting.
 */

export type Player = number;
export type Mark = Player | null;
export type Marks = Mark[]; // length 132

export const FACES = 12;
export const CELLS_PER_FACE = 11;
export const PLAYABLE_PER_FACE = 10;
export const TOTAL_CELLS = 132;

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

/** Slot 0 of every face is the rotation-button center, never marked. */
export function isCenterSlot(slot: number): boolean {
    return slot === 0;
}

/** Fresh 132-element mark array (all null). */
export function initialMarks(): Marks {
    return new Array<Mark>(TOTAL_CELLS).fill(null);
}

/** Apply a 72° face rotation (cw or ccw), returning a new marks array. */
export function apply(face: number, direction: Direction, marks: Marks): Marks {
    const perm = permutations()[moveKey(face, direction)];
    if (!perm) throw new Error(`Unknown move: face ${face} ${direction}`);
    const out: Marks = new Array<Mark>(TOTAL_CELLS);
    for (let i = 0; i < TOTAL_CELLS; i++) {
        out[i] = marks[perm[i]];
    }
    return out;
}

/** All currently-winning perimeter triples across all 12 faces. */
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

/** Whether all *playable* cells (centers excluded) are marked. */
export function isComplete(marks: Marks): boolean {
    for (let f = 0; f < FACES; f++) {
        for (let s = 1; s < CELLS_PER_FACE; s++) {
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

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

let _vertices: Vec3[] | null = null;
let _faceCenters: Vec3[] | null = null;
let _faceNormals: Vec3[] | null = null;
let _faceVertices: number[][] | null = null;
let _adjacency: number[][] | null = null;
let _sharedK: number[][] | null = null;
let _lines: Array<[number, number, number]> | null = null;
let _permutations: Record<string, number[]> | null = null;

/** The 20 dodecahedron vertices. */
export function vertices(): Vec3[] {
    if (_vertices) return _vertices;
    const out: Vec3[] = [];
    for (const x of [-1, 1]) {
        for (const y of [-1, 1]) {
            for (const z of [-1, 1]) {
                out.push([x, y, z]);
            }
        }
    }
    for (const y of [-PHI, PHI]) {
        for (const z of [-INV_PHI, INV_PHI]) {
            out.push([0, y, z]);
        }
    }
    for (const x of [-INV_PHI, INV_PHI]) {
        for (const z of [-PHI, PHI]) {
            out.push([x, 0, z]);
        }
    }
    for (const x of [-PHI, PHI]) {
        for (const y of [-INV_PHI, INV_PHI]) {
            out.push([x, y, 0]);
        }
    }
    _vertices = out;
    return out;
}

/** Inradius of the dodecahedron with our vertex coords (~ 1.376). */
export function inradius(): number {
    return PHI / Math.sqrt(3 - PHI);
}

/** Raw (un-normalized) direction vectors of the 12 face centers. */
function faceCenterDirections(): Vec3[] {
    const out: Vec3[] = [];
    for (const y of [-1, 1]) {
        for (const z of [-PHI, PHI]) {
            out.push([0, y, z]);
        }
    }
    for (const x of [-1, 1]) {
        for (const y of [-PHI, PHI]) {
            out.push([x, y, 0]);
        }
    }
    for (const x of [-PHI, PHI]) {
        for (const z of [-1, 1]) {
            out.push([x, 0, z]);
        }
    }
    return out;
}

/** The 12 face center positions (at the inradius along each face normal). */
export function faceCenters(): Vec3[] {
    if (_faceCenters) return _faceCenters;
    const r = inradius();
    _faceCenters = faceCenterDirections().map((d) => {
        const u = normalize(d);
        return [u[0] * r, u[1] * r, u[2] * r] as Vec3;
    });
    return _faceCenters;
}

/** Unit outward normals for the 12 faces. */
export function faceNormals(): Vec3[] {
    if (_faceNormals) return _faceNormals;
    _faceNormals = faceCenterDirections().map(normalize);
    return _faceNormals;
}

/** 5 vertex indices per face, sorted CCW from outside. */
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
 * The precise 15 cell indices on adjacent faces that move when `face`
 * rotates — 3 per adjacent face (2 corners + 1 edge touching F's perimeter).
 * Used to scope the rotation animation so only cells that actually permute
 * are visually rotated.
 */
export function firstRingCells(face: number): number[] {
    computeFaceData();
    const adj = _adjacency!;
    const sk = _sharedK!;
    const out: number[] = [];
    for (let i = 0; i < 5; i++) {
        const a = adj[face][i];
        const k = sk[face][i];
        // Per-edge layout (mirror of MegaminxCube::buildFacePermutation):
        out.push(indexOf(a, 1 + 2 * ((k + 1) % 5))); // corner at F.v[i]
        out.push(indexOf(a, 2 + 2 * k));              // edge on shared edge
        out.push(indexOf(a, 1 + 2 * k));              // corner at F.v[(i+1)%5]
    }
    return out;
}

/** lines[]: 120 triples of cell indices forming winning perimeter lines. */
export function lines(): Array<[number, number, number]> {
    if (_lines) return _lines;
    const out: Array<[number, number, number]> = [];
    for (let f = 0; f < FACES; f++) {
        for (let i = 0; i < PLAYABLE_PER_FACE; i++) {
            out.push([
                indexOf(f, 1 + i),
                indexOf(f, 1 + ((i + 1) % PLAYABLE_PER_FACE)),
                indexOf(f, 1 + ((i + 2) % PLAYABLE_PER_FACE)),
            ]);
        }
    }
    _lines = out;
    return out;
}

/** Permutation tables for all 24 moves, keyed by `${face}:${direction}`. */
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
    const angle = (2 * Math.PI) / 5;
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
 * Geometry parameters for the Megaminx face tiling.
 *
 * A face is a flat regular pentagon split into 11 polygonal pieces, just like
 * a real Megaminx puzzle face:
 *   - 1 central pentagon (smaller, same orientation as the outer pentagon)
 *   - 5 quad corner pieces — one at each outer pentagon vertex
 *   - 5 quad edge pieces — one along each outer pentagon edge
 *
 * `INNER_PENTAGON_SCALE` (α): how much smaller the central pentagon is than
 *   the outer one. 0.45 means the inner pentagon's vertices sit at 45% of the
 *   way from the face center toward the outer vertices.
 * `CORNER_CUT_FRACTION` (β): where the cut along each outer edge lives —
 *   `β` of the edge near each vertex belongs to that vertex's corner piece.
 * `PIECE_INSET`: each piece is shrunk this fraction toward its own centroid
 *   before rendering, leaving thin "grout" gaps between pieces (visible as
 *   the dark backdrop showing through).
 */
const INNER_PENTAGON_SCALE = 0.45;
const CORNER_CUT_FRACTION = 0.32;
const PIECE_INSET = 0.06;

/**
 * Compute the polygon vertices (in 3D, in the face plane) for a single
 * Megaminx cell. Vertices are ordered such that fan-triangulation from the
 * polygon's centroid produces front-facing triangles relative to the face's
 * outward normal. The returned polygon is already inset by `PIECE_INSET`.
 */
export function cellPolygon(face: number, slot: number): Vec3[] {
    const C = faceCenters()[face];
    const V = faceVertices()[face].map((vi) => vertices()[vi]);

    // Inner pentagon vertices — same orientation as outer, scaled toward center.
    const I = V.map((v) => lerpVec(C, v, INNER_PENTAGON_SCALE));

    // Cut points on each outer edge (V[k] → V[k+1]).
    // cuts[k][0] is `β` along the edge (near V[k]); cuts[k][1] is `1-β` (near V[k+1]).
    const cuts: Array<[Vec3, Vec3]> = V.map((vk, k) => {
        const vNext = V[(k + 1) % 5];
        return [lerpVec(vk, vNext, CORNER_CUT_FRACTION), lerpVec(vk, vNext, 1 - CORNER_CUT_FRACTION)];
    });

    let raw: Vec3[];
    if (slot === 0) {
        // Central pentagon — same orientation as outer
        raw = [I[0], I[1], I[2], I[3], I[4]];
    } else if (slot % 2 === 1) {
        // Corner piece at V[k] — quad: V[k], cut on edge prevK near V[k], I[k], cut on edge k near V[k]
        const k = (slot - 1) / 2;
        const prevK = (k - 1 + 5) % 5;
        raw = [V[k], cuts[prevK][1], I[k], cuts[k][0]];
    } else {
        // Edge piece on edge V[k] → V[k+1] — quad: cut near V[k], cut near V[k+1], I[k+1], I[k]
        const k = (slot - 2) / 2;
        raw = [cuts[k][0], cuts[k][1], I[(k + 1) % 5], I[k]];
    }

    return insetPolygon(raw, PIECE_INSET);
}

/** Centroid of a cell's polygon — used for placing glyphs / rotation arrows. */
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

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
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
        const closest = distances.slice(0, 5).map((x) => x.idx);
        fv.push(sortVerticesCCW(closest, verts, centers[f]));
    }
    _faceVertices = fv;

    const adj: number[][] = [];
    for (let f = 0; f < FACES; f++) {
        adj[f] = [];
        for (let i = 0; i < 5; i++) {
            const vA = fv[f][i];
            const vB = fv[f][(i + 1) % 5];
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
        for (let i = 0; i < 5; i++) {
            const vA = fv[f][i];
            const vB = fv[f][(i + 1) % 5];
            const a = adj[f][i];
            let foundK = -1;
            for (let k = 0; k < 5; k++) {
                const x = fv[a][k];
                const y = fv[a][(k + 1) % 5];
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

    // F's own perimeter — corners and edges cycle by shift.
    for (let i = 0; i < 5; i++) {
        const dstV = ((i + shift) % 5 + 5) % 5;
        perm[indexOf(face, 1 + 2 * dstV)] = indexOf(face, 1 + 2 * i);
        perm[indexOf(face, 2 + 2 * dstV)] = indexOf(face, 2 + 2 * i);
    }

    // First-ring on adjacent faces.
    for (let i = 0; i < 5; i++) {
        const dstEdgeIndex = ((i + shift) % 5 + 5) % 5;
        const srcAdj = adj[face][i];
        const dstAdj = adj[face][dstEdgeIndex];
        const srcK = sk[face][i];
        const dstK = sk[face][dstEdgeIndex];

        const srcCornerLeft = 1 + 2 * ((srcK + 1) % 5);
        const srcEdgeMid = 2 + 2 * srcK;
        const srcCornerRight = 1 + 2 * srcK;

        const dstCornerLeft = 1 + 2 * ((dstK + 1) % 5);
        const dstEdgeMid = 2 + 2 * dstK;
        const dstCornerRight = 1 + 2 * dstK;

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
