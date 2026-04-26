<?php

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;

/**
 * Pure value-object for the CubeTac "Pyraminx" variant — a 3-layer tetrahedron
 * (4 triangular faces × 9 cells per face = 36 cells total).
 *
 * Sticker indexing
 * ----------------
 * Flat 36-element array `[int|null, ...]` indexed by `index = face * 9 + slot`.
 * Per face (slot 0–8):
 *   slot 0,2,4   = corner (up-pointing) cells at vertices v[0], v[1], v[2]
 *   slot 1,3,5   = edge   (up-pointing) cells on edges 0,1,2 (between consecutive vertices)
 *   slot 6,7,8   = interior (down-pointing) cells "near" v[0], v[1], v[2] —
 *                  dead cells: never marked, never form a winning line.
 *
 * Rotations
 * ---------
 * 8 moves total: 4 faces × {cw, ccw}. A CW turn of face F is defined as the
 * rotation that maps F.v[i] → F.v[(i-1) % 3] (the rotation that visually
 * appears clockwise to a viewer outside the tetrahedron). Each turn permutes
 * 18 cells: F's own 9 (3 orbits of 3 — corners, edges, downs), plus 3 cells
 * (2 corners + 1 edge) on each of F's 3 adjacent faces — the up-triangles
 * touching F's perimeter. Down-triangles on adjacent faces stay put (they're
 * dead anyway, so the permutation is observationally identical to identity
 * on them). Validated by `PyraminxCubeTest`.
 *
 * Winning lines
 * -------------
 * Three consecutive cells along the 6-cell perimeter ring of a single face.
 * Ring order: corner v[0] → edge 0 → corner v[1] → edge 1 → corner v[2] →
 * edge 2 → back to corner v[0]. 6 perimeter triples per face × 4 faces =
 * 24 lines total. No cross-face wraparound; no diagonals.
 */
final class PyraminxCube
{
    public const FACES = 4;

    public const CELLS_PER_FACE = 9;

    public const PLAYABLE_PER_FACE = 6;

    public const TOTAL_CELLS = 36;

    public const TOTAL_LINES = 24;

    /** Slots that count as "perimeter" — the 6 up-triangles. */
    public const PLAYABLE_SLOTS = [0, 1, 2, 3, 4, 5];

    /** Slots that are dead (down-triangles): rendered but not markable. */
    public const DEAD_SLOTS = [6, 7, 8];

    /** @var list<list<int>>|null vertex indices per face (3 each, CCW from outside) */
    private static ?array $faceVerticesCache = null;

    /** @var list<list<int>>|null adjacent face per (face, edge_index) — 4×3 */
    private static ?array $adjacencyCache = null;

    /** @var list<list<int>>|null local edge index of F-shared edge on adjacent face */
    private static ?array $sharedEdgeKCache = null;

    /** @var array<string, list<int>>|null permutations keyed by "{face}:{cw|ccw}" */
    private static ?array $permutationsCache = null;

    /** @var list<list<int>>|null winning lines (each is 3 sticker indices) */
    private static ?array $linesCache = null;

    /**
     * Return a fresh 36-element mark array (all nulls).
     *
     * @return list<int|null>
     */
    public static function initialMarks(): array
    {
        return array_fill(0, self::TOTAL_CELLS, null);
    }

    /**
     * Map (face, slot) to a flat sticker index.
     */
    public static function indexOf(int $face, int $slot): int
    {
        return $face * self::CELLS_PER_FACE + $slot;
    }

    /**
     * Map a flat sticker index to (face, slot).
     *
     * @return array{0:int, 1:int}
     */
    public static function faceSlot(int $index): array
    {
        return [intdiv($index, self::CELLS_PER_FACE), $index % self::CELLS_PER_FACE];
    }

    /**
     * Whether a slot is playable (one of the 6 up-triangles forming the perimeter).
     */
    public static function isPlayable(int $slot): bool
    {
        return $slot >= 0 && $slot <= 5;
    }

    /**
     * Apply a face rotation to a marks array and return the new array.
     *
     * @param  list<int|null>  $marks
     * @param  'cw'|'ccw'  $direction
     * @return list<int|null>
     */
    public static function apply(int $face, string $direction, array $marks): array
    {
        if ($face < 0 || $face >= self::FACES) {
            throw new InvalidArgumentException("Invalid face: {$face}");
        }
        if ($direction !== 'cw' && $direction !== 'ccw') {
            throw new InvalidArgumentException("Invalid direction: {$direction}");
        }

        $perm = self::permutations()[self::moveKey($face, $direction)]
            ?? throw new InvalidArgumentException("Unknown move: face {$face} {$direction}");

        $result = [];
        for ($i = 0; $i < self::TOTAL_CELLS; $i++) {
            $result[$i] = $marks[$perm[$i]];
        }

        return $result;
    }

    /**
     * Return all currently-winning lines across all 4 faces.
     *
     * @param  list<int|null>  $marks
     * @return list<array{face:int, cells:list<int>, player:int}>
     */
    public static function winningLines(array $marks): array
    {
        $results = [];
        foreach (self::lines() as $line) {
            $a = $marks[$line[0]];
            $b = $marks[$line[1]];
            $c = $marks[$line[2]];
            if ($a !== null && $a === $b && $b === $c) {
                $results[] = [
                    'face' => intdiv($line[0], self::CELLS_PER_FACE),
                    'cells' => $line,
                    'player' => $a,
                ];
            }
        }

        return $results;
    }

    /**
     * Whether all *playable* cells (the 24 up-triangles, 6 per face) are
     * marked. The 12 dead down-triangles are skipped — they're never marked.
     *
     * @param  list<int|null>  $marks
     */
    public static function isComplete(array $marks): bool
    {
        for ($f = 0; $f < self::FACES; $f++) {
            for ($s = 0; $s < self::PLAYABLE_PER_FACE; $s++) {
                if ($marks[$f * self::CELLS_PER_FACE + $s] === null) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * The 24 winning-line definitions (memoized). Each line is a list of 3
     * sticker indices, all on the same face, walking the 6-cell perimeter.
     *
     * @return list<list<int>>
     */
    public static function lines(): array
    {
        if (self::$linesCache !== null) {
            return self::$linesCache;
        }

        $lines = [];
        for ($f = 0; $f < self::FACES; $f++) {
            for ($i = 0; $i < self::PLAYABLE_PER_FACE; $i++) {
                $lines[] = [
                    self::indexOf($f, $i),
                    self::indexOf($f, ($i + 1) % self::PLAYABLE_PER_FACE),
                    self::indexOf($f, ($i + 2) % self::PLAYABLE_PER_FACE),
                ];
            }
        }

        return self::$linesCache = $lines;
    }

    /**
     * The 8 move permutations (memoized).
     *
     * @return array<string, list<int>>
     */
    public static function permutations(): array
    {
        return self::$permutationsCache ??= self::generatePermutations();
    }

    public static function moveKey(int $face, string $direction): string
    {
        return "{$face}:{$direction}";
    }

    /**
     * 3 vertex indices per face, in CCW order viewed from outside.
     *
     * @return list<list<int>>
     */
    public static function faceVertices(): array
    {
        self::computeFaceData();

        return self::$faceVerticesCache ?? throw new RuntimeException('Face data not computed');
    }

    /**
     * adjacency[face][edge_index] = the adjacent face index across that edge.
     *
     * @return list<list<int>>
     */
    public static function adjacency(): array
    {
        self::computeFaceData();

        return self::$adjacencyCache ?? throw new RuntimeException('Adjacency not computed');
    }

    /**
     * 4 unit face-normal directions for animation/rendering. Each entry is
     * `[float, float, float]`, length = 1.
     *
     * @return list<array{0:float, 1:float, 2:float}>
     */
    public static function faceNormals(): array
    {
        $out = [];
        foreach (self::faceCenterDirections() as $dir) {
            $out[] = self::normalize($dir);
        }

        return $out;
    }

    /**
     * Rotation parameters per move: [face_normal_axis, signed_angle_in_radians].
     * Used by the frontend to animate face rotations consistently with the
     * server-side permutation. Angle sign is +120° for CCW, –120° for CW
     * (right-hand rule about the outward face normal — chosen to match the
     * "v[i] → v[i-1]" CW convention used in `buildFacePermutation`).
     *
     * @return array<string, array{0: array{0:float,1:float,2:float}, 1: float}>
     */
    public static function moveParams(): array
    {
        $angle = 2 * M_PI / 3;
        $normals = self::faceNormals();
        $params = [];
        foreach ($normals as $f => $axis) {
            // Right-hand rule about an OUTWARD face normal: positive angle is
            // counter-clockwise as seen from outside the tetrahedron. So the
            // "CW" move (clockwise to the player) is a negative rotation.
            $params[self::moveKey($f, 'cw')] = [$axis, -$angle];
            $params[self::moveKey($f, 'ccw')] = [$axis, $angle];
        }

        return $params;
    }

    /**
     * Build all 8 permutation tables.
     *
     * @return array<string, list<int>>
     */
    private static function generatePermutations(): array
    {
        self::computeFaceData();

        $perms = [];
        for ($f = 0; $f < self::FACES; $f++) {
            // Face vertices are stored CCW from outside, so vertex (i+1)%3 is
            // CCW of vertex i. CW (clockwise to the viewer) therefore needs
            // shift = -1: vertex i moves to where vertex (i-1) used to be.
            $perms[self::moveKey($f, 'cw')] = self::buildFacePermutation($f, -1);
            $perms[self::moveKey($f, 'ccw')] = self::buildFacePermutation($f, 1);
        }

        return $perms;
    }

    /**
     * Build the permutation for face $face rotated by $shift steps (1=CCW, -1=CW).
     *
     * Convention: CCW = the rotation that maps F.v[i] → F.v[(i+1)%3]. Under
     * this map, the corner at slot `2i` (vertex v[i]) ends up at slot
     * `2*((i+shift)%3)` — i.e. perm[dst] = src. Edge slots and interior
     * down-triangle slots cycle the same way.
     *
     * @return list<int>
     */
    private static function buildFacePermutation(int $face, int $shift): array
    {
        $perm = range(0, self::TOTAL_CELLS - 1);

        $adjacency = self::$adjacencyCache;
        $sharedK = self::$sharedEdgeKCache;
        if ($adjacency === null || $sharedK === null) {
            throw new RuntimeException('Face data not computed');
        }

        // F's own cells: 3 corner slots cycle, 3 edge slots cycle, 3 down-triangle slots cycle.
        for ($i = 0; $i < 3; $i++) {
            $srcVertex = $i;
            $dstVertex = (($i + $shift) % 3 + 3) % 3;

            // Corner slot
            $perm[self::indexOf($face, 2 * $dstVertex)] = self::indexOf($face, 2 * $srcVertex);
            // Edge slot (edge i sits between vertex i and vertex (i+1)%3)
            $perm[self::indexOf($face, 2 * $dstVertex + 1)] = self::indexOf($face, 2 * $srcVertex + 1);
            // Down-triangle slot ("near" vertex i)
            $perm[self::indexOf($face, 6 + $dstVertex)] = self::indexOf($face, 6 + $srcVertex);
        }

        // Adjacent faces' "first ring" cells (3 per adjacent face × 3 adjacents = 9 per rotation).
        // For each edge index i of F (between F.v[i] and F.v[(i+1)%3]):
        //   adjacency[F][i] is the adjacent face A_i.
        //   On A_i, the F-shared edge is edge sharedK[F][i] (with reversed CCW order:
        //   A_i.v[k] = F.v[(i+1)%3], A_i.v[(k+1)%3] = F.v[i]).
        for ($i = 0; $i < 3; $i++) {
            $srcEdgeIndex = $i;
            $dstEdgeIndex = (($i + $shift) % 3 + 3) % 3;

            $srcAdj = $adjacency[$face][$srcEdgeIndex];
            $dstAdj = $adjacency[$face][$dstEdgeIndex];
            $srcK = $sharedK[$face][$srcEdgeIndex];
            $dstK = $sharedK[$face][$dstEdgeIndex];

            // Source slots on srcAdj (the 3 up-cells of srcAdj touching F)
            $srcCornerLeft = 2 * $srcK;                    // at F.v[(i+1)%3]
            $srcEdgeMid = 2 * $srcK + 1;                   // on F-srcAdj shared edge
            $srcCornerRight = 2 * (($srcK + 1) % 3);       // at F.v[i]

            // Destination slots on dstAdj
            $dstCornerLeft = 2 * $dstK;                    // at F.v[(i+shift+1)%3]
            $dstEdgeMid = 2 * $dstK + 1;
            $dstCornerRight = 2 * (($dstK + 1) % 3);       // at F.v[(i+shift)%3]

            $perm[self::indexOf($dstAdj, $dstCornerLeft)] = self::indexOf($srcAdj, $srcCornerLeft);
            $perm[self::indexOf($dstAdj, $dstEdgeMid)] = self::indexOf($srcAdj, $srcEdgeMid);
            $perm[self::indexOf($dstAdj, $dstCornerRight)] = self::indexOf($srcAdj, $srcCornerRight);
        }

        return $perm;
    }

    /**
     * Discover face vertex lists, adjacency, and shared-edge mapping from
     * tetrahedron geometry. Memoized.
     */
    private static function computeFaceData(): void
    {
        if (self::$faceVerticesCache !== null) {
            return;
        }

        $vertices = self::vertices();
        $faceCenters = self::faceCenters();

        // Step 1: per face, find the 3 vertices closest to the face center.
        // (For a regular tetrahedron, exactly 3 of the 4 vertices are on each face.)
        $faceVertices = [];
        for ($f = 0; $f < self::FACES; $f++) {
            $center = $faceCenters[$f];
            $distances = [];
            for ($v = 0; $v < count($vertices); $v++) {
                $distances[$v] = self::distanceSq($vertices[$v], $center);
            }
            asort($distances);
            $closestThree = array_slice(array_keys($distances), 0, 3);
            $faceVertices[$f] = self::sortVerticesCCW($closestThree, $vertices, $center);
        }
        self::$faceVerticesCache = $faceVertices;

        // Step 2: adjacency. For each (face F, edge i), find the OTHER face containing both endpoints.
        $adjacency = [];
        for ($f = 0; $f < self::FACES; $f++) {
            $adjacency[$f] = [];
            for ($i = 0; $i < 3; $i++) {
                $vA = $faceVertices[$f][$i];
                $vB = $faceVertices[$f][($i + 1) % 3];
                $found = null;
                for ($g = 0; $g < self::FACES; $g++) {
                    if ($g === $f) {
                        continue;
                    }
                    if (in_array($vA, $faceVertices[$g], true)
                        && in_array($vB, $faceVertices[$g], true)) {
                        $found = $g;
                        break;
                    }
                }
                if ($found === null) {
                    throw new RuntimeException("No adjacent face found for face {$f} edge {$i}");
                }
                $adjacency[$f][$i] = $found;
            }
        }
        self::$adjacencyCache = $adjacency;

        // Step 3: per (face F, edge i), find the local edge index k on the adjacent face
        // such that the same edge is between adj.v[k] and adj.v[(k+1)%3].
        // We REQUIRE reversed orientation: adj.v[k] = F.v[(i+1)%3], adj.v[(k+1)%3] = F.v[i].
        $sharedK = [];
        for ($f = 0; $f < self::FACES; $f++) {
            $sharedK[$f] = [];
            for ($i = 0; $i < 3; $i++) {
                $vA = $faceVertices[$f][$i];
                $vB = $faceVertices[$f][($i + 1) % 3];
                $adj = $adjacency[$f][$i];
                $foundK = null;
                for ($k = 0; $k < 3; $k++) {
                    $a = $faceVertices[$adj][$k];
                    $b = $faceVertices[$adj][($k + 1) % 3];
                    if ($a === $vB && $b === $vA) {
                        $foundK = $k;
                        break;
                    }
                    if ($a === $vA && $b === $vB) {
                        throw new RuntimeException(
                            "Face {$adj} traverses edge ({$vA},{$vB}) in the SAME direction as face {$f} — ".
                            'expected reversed CCW orientation for outward-facing triangles.'
                        );
                    }
                }
                if ($foundK === null) {
                    throw new RuntimeException("Adjacent face {$adj} does not contain edge ({$vA},{$vB}) of face {$f}");
                }
                $sharedK[$f][$i] = $foundK;
            }
        }
        self::$sharedEdgeKCache = $sharedK;
    }

    /**
     * The 4 tetrahedron vertices (alternate corners of a unit cube).
     *
     * @return list<array{0:float, 1:float, 2:float}>
     */
    private static function vertices(): array
    {
        return [
            [1.0, 1.0, 1.0],
            [1.0, -1.0, -1.0],
            [-1.0, 1.0, -1.0],
            [-1.0, -1.0, 1.0],
        ];
    }

    /**
     * The 4 face centers (at the tetrahedron's inradius along each face normal).
     *
     * @return list<array{0:float, 1:float, 2:float}>
     */
    private static function faceCenters(): array
    {
        $r = self::inradius();
        $out = [];
        foreach (self::faceCenterDirections() as $dir) {
            $unit = self::normalize($dir);
            $out[] = [$unit[0] * $r, $unit[1] * $r, $unit[2] * $r];
        }

        return $out;
    }

    /**
     * Raw face-center direction vectors: each face is opposite a vertex, so
     * its outward normal points in the direction of `-vertex_i`. Order is
     * fixed and referenced by face index 0..3 throughout the codebase:
     *   face 0 ↔ opposite v0=(+,+,+) → outward normal (-,-,-)
     *   face 1 ↔ opposite v1=(+,-,-) → outward normal (-,+,+)
     *   face 2 ↔ opposite v2=(-,+,-) → outward normal (+,-,+)
     *   face 3 ↔ opposite v3=(-,-,+) → outward normal (+,+,-)
     *
     * @return list<array{0:float, 1:float, 2:float}>
     */
    private static function faceCenterDirections(): array
    {
        $verts = self::vertices();
        $dirs = [];
        foreach ($verts as $v) {
            $dirs[] = [-$v[0], -$v[1], -$v[2]];
        }

        return $dirs;
    }

    /**
     * Inradius of the tetrahedron with our vertex coordinates.
     * Vertex magnitude = sqrt(3); face center sits at 1/sqrt(3) ≈ 0.577.
     */
    private static function inradius(): float
    {
        return 1 / sqrt(3);
    }

    /**
     * Sort the 3 vertex indices CCW around the face center, viewed from
     * OUTSIDE the polyhedron (i.e. CCW with respect to the outward face
     * normal; right-hand-rule positive sense).
     *
     * @param  list<int>  $vertexIndices
     * @param  list<array{0:float, 1:float, 2:float}>  $allVertices
     * @param  array{0:float, 1:float, 2:float}  $faceCenter
     * @return list<int>
     */
    private static function sortVerticesCCW(array $vertexIndices, array $allVertices, array $faceCenter): array
    {
        $normal = self::normalize($faceCenter);
        // Build an in-plane basis (u, w) such that u × w = normal
        $u = self::anyOrthogonal($normal);
        $w = self::cross($normal, $u);

        $angles = [];
        foreach ($vertexIndices as $idx) {
            $v = $allVertices[$idx];
            $rel = [$v[0] - $faceCenter[0], $v[1] - $faceCenter[1], $v[2] - $faceCenter[2]];
            $x = self::dot($rel, $u);
            $y = self::dot($rel, $w);
            $angles[$idx] = atan2($y, $x);
        }
        // CCW = increasing angle in the (u, w, normal) right-handed frame.
        asort($angles);

        return array_keys($angles);
    }

    /** @param array{0:float, 1:float, 2:float} $v */
    private static function normalize(array $v): array
    {
        $len = sqrt($v[0] * $v[0] + $v[1] * $v[1] + $v[2] * $v[2]);
        if ($len === 0.0) {
            throw new RuntimeException('Cannot normalize zero vector');
        }

        return [$v[0] / $len, $v[1] / $len, $v[2] / $len];
    }

    /**
     * Pick any unit vector orthogonal to the given unit vector.
     *
     * @param  array{0:float, 1:float, 2:float}  $n
     * @return array{0:float, 1:float, 2:float}
     */
    private static function anyOrthogonal(array $n): array
    {
        $ref = abs($n[0]) < 0.9 ? [1.0, 0.0, 0.0] : [0.0, 1.0, 0.0];

        return self::normalize(self::cross($n, $ref));
    }

    /**
     * @param  array{0:float, 1:float, 2:float}  $a
     * @param  array{0:float, 1:float, 2:float}  $b
     * @return array{0:float, 1:float, 2:float}
     */
    private static function cross(array $a, array $b): array
    {
        return [
            $a[1] * $b[2] - $a[2] * $b[1],
            $a[2] * $b[0] - $a[0] * $b[2],
            $a[0] * $b[1] - $a[1] * $b[0],
        ];
    }

    /**
     * @param  array{0:float, 1:float, 2:float}  $a
     * @param  array{0:float, 1:float, 2:float}  $b
     */
    private static function dot(array $a, array $b): float
    {
        return $a[0] * $b[0] + $a[1] * $b[1] + $a[2] * $b[2];
    }

    /**
     * @param  array{0:float, 1:float, 2:float}  $a
     * @param  array{0:float, 1:float, 2:float}  $b
     */
    private static function distanceSq(array $a, array $b): float
    {
        $dx = $a[0] - $b[0];
        $dy = $a[1] - $b[1];
        $dz = $a[2] - $b[2];

        return $dx * $dx + $dy * $dy + $dz * $dz;
    }
}
