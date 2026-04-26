<?php

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;

/**
 * Pure value-object for the CubeTac "Megaminx" variant — a 3×3 dodecahedron
 * (12 pentagonal faces × 11 cells per face = 132 cells total).
 *
 * Sticker indexing
 * ----------------
 * Flat 132-element array `[int|null, ...]` indexed by `index = face * 11 + slot`.
 * Per face (slot 0–10):
 *   slot 0       = face center (button only — never marked, never permuted by the face's own rotation)
 *   slot 1,3,5,7,9 = corner cells at vertices 0..4 (pentagon vertices in CCW order viewed from outside)
 *   slot 2,4,6,8,10 = edge cells on edges 0..4 (between consecutive vertices)
 *
 * Rotations
 * ---------
 * 24 moves total: 12 faces × {cw, ccw}. A CW turn of face F is defined as the
 * rotation that maps F.v[i] → F.v[(i+1) % 5]. Each turn permutes 25 cells:
 * 5 corners + 5 edges of F itself, plus 3 cells (2 corners + 1 edge) on each
 * of F's 5 adjacent faces (the cells that touch F's perimeter). The center
 * of F maps to itself. Validated by `MegaminxCubeTest`.
 *
 * Winning lines
 * -------------
 * Three consecutive cells along the perimeter of a single pentagonal face.
 * 10 perimeter triples per face × 12 faces = 120 lines total. No cross-face
 * wraparound; no diagonals across the center.
 */
final class MegaminxCube
{
    public const FACES = 12;

    public const CELLS_PER_FACE = 11;

    public const PLAYABLE_PER_FACE = 10;

    public const TOTAL_CELLS = 132;

    public const TOTAL_LINES = 120;

    /** @var list<list<int>>|null vertex indices per face (5 each, CCW from outside) */
    private static ?array $faceVerticesCache = null;

    /** @var list<list<int>>|null adjacent face per (face, edge_index) — 12×5 */
    private static ?array $adjacencyCache = null;

    /** @var list<list<int>>|null local edge index of F-shared edge on adjacent face */
    private static ?array $sharedEdgeKCache = null;

    /** @var array<string, list<int>>|null permutations keyed by "{face}:{cw|ccw}" */
    private static ?array $permutationsCache = null;

    /** @var list<list<int>>|null winning lines (each is 3 sticker indices) */
    private static ?array $linesCache = null;

    /**
     * Return a fresh 132-element mark array (all nulls).
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
     * Whether a slot is a center (slot 0) — never marked, never permuted by its own face.
     */
    public static function isCenter(int $slot): bool
    {
        return $slot === 0;
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
     * Return all currently-winning lines across all 12 faces.
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
     * Whether all *playable* cells (everything except the 12 face centers) are marked.
     *
     * @param  list<int|null>  $marks
     */
    public static function isComplete(array $marks): bool
    {
        for ($f = 0; $f < self::FACES; $f++) {
            for ($s = 1; $s < self::CELLS_PER_FACE; $s++) {
                if ($marks[$f * self::CELLS_PER_FACE + $s] === null) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * The 120 winning-line definitions (memoized). Each line is a list of 3
     * sticker indices, all on the same face, walking the perimeter.
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
                    self::indexOf($f, 1 + $i),
                    self::indexOf($f, 1 + (($i + 1) % self::PLAYABLE_PER_FACE)),
                    self::indexOf($f, 1 + (($i + 2) % self::PLAYABLE_PER_FACE)),
                ];
            }
        }

        return self::$linesCache = $lines;
    }

    /**
     * The 24 move permutations (memoized).
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
     * 5 vertex indices per face, in CCW order viewed from outside.
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
     * 12 unit face-normal directions for animation/rendering. Each entry is
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
     * server-side permutation. Angle sign is +72° for CW, –72° for CCW
     * (right-hand rule about the outward face normal — chosen to match the
     * "v[i] → v[i+1]" CW convention used in `buildFacePermutation`).
     *
     * @return array<string, array{0: array{0:float,1:float,2:float}, 1: float}>
     */
    public static function moveParams(): array
    {
        $angle = 2 * M_PI / 5;
        $normals = self::faceNormals();
        $params = [];
        foreach ($normals as $f => $axis) {
            // Right-hand rule about an OUTWARD face normal: positive angle is
            // counter-clockwise as seen from outside the polyhedron. So the
            // "CW" move (clockwise to the player) is a negative rotation.
            $params[self::moveKey($f, 'cw')] = [$axis, -$angle];
            $params[self::moveKey($f, 'ccw')] = [$axis, $angle];
        }

        return $params;
    }

    /**
     * Build all 24 permutation tables.
     *
     * @return array<string, list<int>>
     */
    private static function generatePermutations(): array
    {
        self::computeFaceData();

        $perms = [];
        for ($f = 0; $f < self::FACES; $f++) {
            // Face vertices are stored CCW from outside, so vertex (i+1)%5 is
            // CCW of vertex i. CW (clockwise to the viewer) therefore needs
            // shift = -1: vertex i moves to where vertex (i-1) used to be.
            $perms[self::moveKey($f, 'cw')] = self::buildFacePermutation($f, -1);
            $perms[self::moveKey($f, 'ccw')] = self::buildFacePermutation($f, 1);
        }

        return $perms;
    }

    /**
     * Build the permutation for face $face rotated by $shift steps (1=CW, -1=CCW).
     *
     * Convention: CW = the rotation that maps F.v[i] → F.v[(i+1)%5]. Under this
     * map, the sticker at slot `1 + 2i` (corner at v[i]) ends up at slot
     * `1 + 2((i+1)%5)` (corner at v[i+1]) — i.e. perm[dst] = src.
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

        // F's own perimeter: 5 corner slots cycle, 5 edge slots cycle.
        for ($i = 0; $i < 5; $i++) {
            $srcVertex = $i;
            $dstVertex = (($i + $shift) % 5 + 5) % 5;

            // Corner slot
            $perm[self::indexOf($face, 1 + 2 * $dstVertex)] = self::indexOf($face, 1 + 2 * $srcVertex);
            // Edge slot (edge i sits between vertex i and vertex i+1)
            $perm[self::indexOf($face, 2 + 2 * $dstVertex)] = self::indexOf($face, 2 + 2 * $srcVertex);
        }

        // Adjacent faces' "first ring" cells (15 per rotation: 3 per adjacent face).
        // For each edge index i of F (between F.v[i] and F.v[(i+1)%5]):
        //   adjacency[F][i] is the adjacent face A_i.
        //   On A_i, the F-shared edge is edge sharedK[F][i] (with reversed CCW order
        //   asserted in computeFaceData — so A_i.v[k] = F.v[(i+1)%5], A_i.v[(k+1)%5] = F.v[i]).
        //
        // CW: corner at F.v[i] (on A_i, slot 1+2*((k+1)%5)) → corner at F.v[i+1] on A_{i+1}'s slot 1+2*((k'+1)%5)
        //     edge on shared edge of A_i (slot 2+2*k) → edge on shared edge of A_{i+1} (slot 2+2*k')
        //     corner at F.v[i+1] (on A_i, slot 1+2*k) → corner at F.v[i+2] on A_{i+1} (slot 1+2*k')
        for ($i = 0; $i < 5; $i++) {
            $srcEdgeIndex = $i;
            $dstEdgeIndex = (($i + $shift) % 5 + 5) % 5;

            $srcAdj = $adjacency[$face][$srcEdgeIndex];
            $dstAdj = $adjacency[$face][$dstEdgeIndex];
            $srcK = $sharedK[$face][$srcEdgeIndex];
            $dstK = $sharedK[$face][$dstEdgeIndex];

            // Source slots on srcAdj (the 3 cells of srcAdj touching F)
            $srcCornerLeft = 1 + 2 * (($srcK + 1) % 5);   // at F.v[i]
            $srcEdgeMid = 2 + 2 * $srcK;                   // on F-srcAdj shared edge
            $srcCornerRight = 1 + 2 * $srcK;               // at F.v[(i+1)%5]

            // Destination slots on dstAdj
            $dstCornerLeft = 1 + 2 * (($dstK + 1) % 5);   // at F.v[(i+shift)%5]
            $dstEdgeMid = 2 + 2 * $dstK;
            $dstCornerRight = 1 + 2 * $dstK;               // at F.v[(i+shift+1)%5]

            $perm[self::indexOf($dstAdj, $dstCornerLeft)] = self::indexOf($srcAdj, $srcCornerLeft);
            $perm[self::indexOf($dstAdj, $dstEdgeMid)] = self::indexOf($srcAdj, $srcEdgeMid);
            $perm[self::indexOf($dstAdj, $dstCornerRight)] = self::indexOf($srcAdj, $srcCornerRight);
        }

        return $perm;
    }

    /**
     * Discover face vertex lists, adjacency, and shared-edge mapping from
     * dodecahedron geometry. Memoized.
     */
    private static function computeFaceData(): void
    {
        if (self::$faceVerticesCache !== null) {
            return;
        }

        $vertices = self::vertices();
        $faceCenters = self::faceCenters();

        // Step 1: per face, find the 5 vertices closest to the face center.
        $faceVertices = [];
        for ($f = 0; $f < self::FACES; $f++) {
            $center = $faceCenters[$f];
            $distances = [];
            for ($v = 0; $v < count($vertices); $v++) {
                $distances[$v] = self::distanceSq($vertices[$v], $center);
            }
            asort($distances);
            $closestFive = array_slice(array_keys($distances), 0, 5);
            $faceVertices[$f] = self::sortVerticesCCW($closestFive, $vertices, $center);
        }
        self::$faceVerticesCache = $faceVertices;

        // Step 2: adjacency. For each (face F, edge i), find the OTHER face containing both endpoints.
        $adjacency = [];
        for ($f = 0; $f < self::FACES; $f++) {
            $adjacency[$f] = [];
            for ($i = 0; $i < 5; $i++) {
                $vA = $faceVertices[$f][$i];
                $vB = $faceVertices[$f][($i + 1) % 5];
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
        // such that the same edge is between adj.v[k] and adj.v[(k+1)%5].
        // We REQUIRE reversed orientation: adj.v[k] = F.v[(i+1)%5], adj.v[(k+1)%5] = F.v[i].
        // Throw immediately if any face is oriented the wrong way (would silently produce
        // a wrong-but-plausible permutation otherwise — see advisor note).
        $sharedK = [];
        for ($f = 0; $f < self::FACES; $f++) {
            $sharedK[$f] = [];
            for ($i = 0; $i < 5; $i++) {
                $vA = $faceVertices[$f][$i];
                $vB = $faceVertices[$f][($i + 1) % 5];
                $adj = $adjacency[$f][$i];
                $foundK = null;
                for ($k = 0; $k < 5; $k++) {
                    $a = $faceVertices[$adj][$k];
                    $b = $faceVertices[$adj][($k + 1) % 5];
                    if ($a === $vB && $b === $vA) {
                        $foundK = $k;
                        break;
                    }
                    if ($a === $vA && $b === $vB) {
                        throw new RuntimeException(
                            "Face {$adj} traverses edge ({$vA},{$vB}) in the SAME direction as face {$f} — ".
                            'expected reversed CCW orientation for outward-facing pentagons.'
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
     * The 20 dodecahedron vertices, hardcoded with the standard golden-ratio
     * coordinates: (±1,±1,±1) ∪ (0,±φ,±1/φ) ∪ (±1/φ,0,±φ) ∪ (±φ,±1/φ,0).
     *
     * @return list<array{0:float, 1:float, 2:float}>
     */
    private static function vertices(): array
    {
        $phi = (1 + sqrt(5)) / 2;
        $inv = 1 / $phi;
        $verts = [];
        // Cube vertices
        foreach ([-1, 1] as $x) {
            foreach ([-1, 1] as $y) {
                foreach ([-1, 1] as $z) {
                    $verts[] = [(float) $x, (float) $y, (float) $z];
                }
            }
        }
        // (0, ±φ, ±1/φ)
        foreach ([-$phi, $phi] as $y) {
            foreach ([-$inv, $inv] as $z) {
                $verts[] = [0.0, (float) $y, (float) $z];
            }
        }
        // (±1/φ, 0, ±φ)
        foreach ([-$inv, $inv] as $x) {
            foreach ([-$phi, $phi] as $z) {
                $verts[] = [(float) $x, 0.0, (float) $z];
            }
        }
        // (±φ, ±1/φ, 0)
        foreach ([-$phi, $phi] as $x) {
            foreach ([-$inv, $inv] as $y) {
                $verts[] = [(float) $x, (float) $y, 0.0];
            }
        }

        return $verts;
    }

    /**
     * The 12 face centers (at the dodecahedron's inradius along each face normal).
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
     * Raw face-center direction vectors (not normalized). The 12 icosahedron
     * vertex directions: (0,±1,±φ), (±1,±φ,0), (±φ,0,±1). Order is fixed and
     * referenced by face index 0..11 throughout the codebase.
     *
     * @return list<array{0:float, 1:float, 2:float}>
     */
    private static function faceCenterDirections(): array
    {
        $phi = (1 + sqrt(5)) / 2;
        $dirs = [];
        // (0, ±1, ±φ)
        foreach ([-1, 1] as $y) {
            foreach ([-$phi, $phi] as $z) {
                $dirs[] = [0.0, (float) $y, (float) $z];
            }
        }
        // (±1, ±φ, 0)
        foreach ([-1, 1] as $x) {
            foreach ([-$phi, $phi] as $y) {
                $dirs[] = [(float) $x, (float) $y, 0.0];
            }
        }
        // (±φ, 0, ±1)
        foreach ([-$phi, $phi] as $x) {
            foreach ([-1, 1] as $z) {
                $dirs[] = [(float) $x, 0.0, (float) $z];
            }
        }

        return $dirs;
    }

    /**
     * Inradius of the dodecahedron with our vertex coordinates (vertex
     * |v| = sqrt(3)). Equals φ / sqrt(3 - φ) ≈ 1.376.
     */
    private static function inradius(): float
    {
        $phi = (1 + sqrt(5)) / 2;

        return $phi / sqrt(3 - $phi);
    }

    /**
     * Sort the 5 vertex indices CCW around the face center, viewed from
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
     * Pick any unit vector orthogonal to the given unit vector. Stable when
     * the input avoids the chosen reference axis; for face normals on a
     * dodecahedron, none align with (1, 0, 0), so this is safe.
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
