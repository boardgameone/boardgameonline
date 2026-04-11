<?php

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;

/**
 * Pure value-object for the CubeTac game's 3x3x3 Rubik's cube state.
 *
 * Sticker indexing
 * ----------------
 * A flat 54-element array `[int|null, ...]` indexed by
 *   index = face * 9 + row * 3 + col
 *
 * Each non-null slot holds the slot-index (0..N-1) of the player who
 * marked it. The per-face winning-line check compares marks with `===`,
 * so any scalar type (int or string) works; this service is intentionally
 * agnostic about player identity encoding.
 *
 * Face order (Singmaster-adjacent):
 *   U=0, D=1, L=2, R=3, F=4, B=5
 *
 * Per-face (row, col) basis is defined by `faceOrigin`, `faceRowAxis`,
 * `faceColAxis` below. The basis is internally consistent — the
 * permutation tables are generated deterministically from it.
 *
 * Move notation
 * -------------
 * Twelve quarter turns: U, U', D, D', L, L', R, R', F, F', B, B'.
 * Permutation tables are generated once on first use by rotating each
 * sticker's 3D lattice point about the move axis and looking up its
 * destination. The tables are memoized per process. Correctness is
 * verified by unit tests asserting X^4 = I and X * X' = I for all 12
 * moves.
 *
 * Winning lines
 * -------------
 * Three-in-a-row is detected per face only: rows (3), columns (3), and
 * diagonals (2) — 8 lines per face × 6 faces = 48 lines total. No
 * cross-face wraparound.
 */
final class RubikCube
{
    public const FACE_U = 0;

    public const FACE_D = 1;

    public const FACE_L = 2;

    public const FACE_R = 3;

    public const FACE_F = 4;

    public const FACE_B = 5;

    /** @var list<string> */
    public const MOVES = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];

    /** @var array<string, list<int>>|null */
    private static ?array $permutationsCache = null;

    /** @var list<array{face:int, cells: list<array{0:int,1:int}>}>|null */
    private static ?array $linesCache = null;

    /**
     * Return a fresh 54-element mark array (all nulls).
     *
     * @return list<int|null>
     */
    public static function initialMarks(): array
    {
        return array_fill(0, 54, null);
    }

    /**
     * Map (face, row, col) to a flat sticker index.
     */
    public static function indexOf(int $face, int $row, int $col): int
    {
        return $face * 9 + $row * 3 + $col;
    }

    /**
     * Map a flat sticker index to (face, row, col).
     *
     * @return array{0:int, 1:int, 2:int}
     */
    public static function faceRowCol(int $index): array
    {
        return [intdiv($index, 9), intdiv($index % 9, 3), $index % 3];
    }

    /**
     * Apply a quarter-turn to a marks array and return the new array.
     *
     * @param  list<int|null>  $marks
     * @return list<int|null>
     */
    public static function apply(string $move, array $marks): array
    {
        $perm = self::permutations()[$move] ?? throw new InvalidArgumentException("Unknown move: {$move}");
        $result = [];
        for ($i = 0; $i < 54; $i++) {
            $result[$i] = $marks[$perm[$i]];
        }

        return $result;
    }

    /**
     * Return all currently-winning lines across all 6 faces (for either player).
     *
     * @param  list<int|null>  $marks
     * @return list<array{face:int, cells: list<array{0:int,1:int}>, player:int}>
     */
    public static function winningLines(array $marks): array
    {
        $results = [];
        foreach (self::lines() as $line) {
            $a = $marks[self::indexOf($line['face'], $line['cells'][0][0], $line['cells'][0][1])];
            $b = $marks[self::indexOf($line['face'], $line['cells'][1][0], $line['cells'][1][1])];
            $c = $marks[self::indexOf($line['face'], $line['cells'][2][0], $line['cells'][2][1])];
            if ($a !== null && $a === $b && $b === $c) {
                $results[] = [
                    'face' => $line['face'],
                    'cells' => $line['cells'],
                    'player' => $a,
                ];
            }
        }

        return $results;
    }

    /**
     * Whether all 54 stickers are marked.
     *
     * @param  list<int|null>  $marks
     */
    public static function isComplete(array $marks): bool
    {
        foreach ($marks as $m) {
            if ($m === null) {
                return false;
            }
        }

        return true;
    }

    /**
     * The 48 winning-line definitions (memoized).
     *
     * @return list<array{face:int, cells: list<array{0:int,1:int}>}>
     */
    public static function lines(): array
    {
        if (self::$linesCache !== null) {
            return self::$linesCache;
        }

        $lines = [];
        for ($face = 0; $face < 6; $face++) {
            for ($r = 0; $r < 3; $r++) {
                $lines[] = ['face' => $face, 'cells' => [[$r, 0], [$r, 1], [$r, 2]]];
            }
            for ($c = 0; $c < 3; $c++) {
                $lines[] = ['face' => $face, 'cells' => [[0, $c], [1, $c], [2, $c]]];
            }
            $lines[] = ['face' => $face, 'cells' => [[0, 0], [1, 1], [2, 2]]];
            $lines[] = ['face' => $face, 'cells' => [[0, 2], [1, 1], [2, 0]]];
        }

        return self::$linesCache = $lines;
    }

    /**
     * The 12 move permutations (memoized).
     *
     * @return array<string, list<int>>
     */
    public static function permutations(): array
    {
        return self::$permutationsCache ??= self::generatePermutations();
    }

    /**
     * Build permutation tables deterministically from geometry.
     *
     * For each move (axis, angle): iterate every sticker, skip those not
     * in the rotating layer, rotate their 3D lattice point and face
     * normal, look up the destination sticker index, and record the
     * mapping in gather form (`new[dst] = old[src]` ⇒ `perm[dst] = src`).
     *
     * Correctness relies on tests asserting `apply^4 = identity` and
     * `apply(M) ∘ apply(M') = identity` for all moves.
     *
     * @return array<string, list<int>>
     */
    private static function generatePermutations(): array
    {
        $positions = [];
        $normals = [];
        for ($i = 0; $i < 54; $i++) {
            [$face, $row, $col] = self::faceRowCol($i);
            $positions[$i] = self::sticker3D($face, $row, $col);
            $normals[$i] = self::faceNormal($face);
        }

        $lookup = [];
        for ($i = 0; $i < 54; $i++) {
            $lookup[self::positionKey($positions[$i], $normals[$i])] = $i;
        }

        $permutations = [];
        foreach (self::moveParams() as $name => $params) {
            /** @var array{0:int,1:int,2:int} $axis */
            $axis = $params[0];
            /** @var float $angle */
            $angle = $params[1];

            $perm = range(0, 53);

            for ($src = 0; $src < 54; $src++) {
                $pos = $positions[$src];
                // Layer test: the sticker is in the rotating layer iff its
                // position's projection onto the move axis is +1 (the
                // axis's "positive" end). Lattice coords are integers in
                // {-1,0,1}, so the projection is always an integer.
                $along = $pos[0] * $axis[0] + $pos[1] * $axis[1] + $pos[2] * $axis[2];
                if ($along < 0.5) {
                    continue;
                }

                $newPos = self::rotateVector($pos, $axis, $angle);
                $newNormal = self::rotateVector($normals[$src], $axis, $angle);
                $key = self::positionKey($newPos, $newNormal);

                if (! isset($lookup[$key])) {
                    throw new RuntimeException("Missing destination for move {$name} from src {$src} (key {$key})");
                }

                $perm[$lookup[$key]] = $src;
            }

            $permutations[$name] = $perm;
        }

        return $permutations;
    }

    /**
     * Rotation parameters per move: [axis, angle_in_radians].
     *
     * Axis choice is anchored to the face normal, so that the layer test
     * `pos·axis >= 0.5` catches exactly the rotating layer (e.g. the U
     * layer has all stickers with y=+1).
     *
     * Angle sign conventions are internally consistent with the generator
     * (quarter-turn clockwise vs counterclockwise is arbitrary for
     * correctness — only `M^4 = I` and `M * M' = I` matter). The
     * frontend reads the same angle table to animate rotations so that
     * visible rotation direction matches the permutation.
     *
     * @return array<string, array{0: array{0:int,1:int,2:int}, 1: float}>
     */
    public static function moveParams(): array
    {
        $q = M_PI_2;

        return [
            'U' => [[0, 1, 0], -$q],
            "U'" => [[0, 1, 0], $q],
            'D' => [[0, -1, 0], -$q],
            "D'" => [[0, -1, 0], $q],
            'L' => [[-1, 0, 0], -$q],
            "L'" => [[-1, 0, 0], $q],
            'R' => [[1, 0, 0], -$q],
            "R'" => [[1, 0, 0], $q],
            'F' => [[0, 0, 1], -$q],
            "F'" => [[0, 0, 1], $q],
            'B' => [[0, 0, -1], -$q],
            "B'" => [[0, 0, -1], $q],
        ];
    }

    /**
     * 3D lattice position of the sticker at (face, row, col).
     *
     * @return array{0:int, 1:int, 2:int}
     */
    private static function sticker3D(int $face, int $row, int $col): array
    {
        $origin = self::faceOrigin($face);
        $rowAxis = self::faceRowAxis($face);
        $colAxis = self::faceColAxis($face);

        return [
            $origin[0] + $row * $rowAxis[0] + $col * $colAxis[0],
            $origin[1] + $row * $rowAxis[1] + $col * $colAxis[1],
            $origin[2] + $row * $rowAxis[2] + $col * $colAxis[2],
        ];
    }

    /** @return array{0:int, 1:int, 2:int} */
    private static function faceOrigin(int $face): array
    {
        return match ($face) {
            self::FACE_U => [-1, 1, -1],
            self::FACE_D => [-1, -1, -1],
            self::FACE_F => [-1, 1, 1],
            self::FACE_B => [-1, 1, -1],
            self::FACE_L => [-1, 1, -1],
            self::FACE_R => [1, 1, -1],
            default => throw new InvalidArgumentException("Invalid face: {$face}"),
        };
    }

    /** @return array{0:int, 1:int, 2:int} */
    private static function faceRowAxis(int $face): array
    {
        return match ($face) {
            self::FACE_U, self::FACE_D => [0, 0, 1],
            self::FACE_F, self::FACE_B, self::FACE_L, self::FACE_R => [0, -1, 0],
            default => throw new InvalidArgumentException("Invalid face: {$face}"),
        };
    }

    /** @return array{0:int, 1:int, 2:int} */
    private static function faceColAxis(int $face): array
    {
        return match ($face) {
            self::FACE_U, self::FACE_D, self::FACE_F, self::FACE_B => [1, 0, 0],
            self::FACE_L, self::FACE_R => [0, 0, 1],
            default => throw new InvalidArgumentException("Invalid face: {$face}"),
        };
    }

    /** @return array{0:int, 1:int, 2:int} */
    private static function faceNormal(int $face): array
    {
        return match ($face) {
            self::FACE_U => [0, 1, 0],
            self::FACE_D => [0, -1, 0],
            self::FACE_L => [-1, 0, 0],
            self::FACE_R => [1, 0, 0],
            self::FACE_F => [0, 0, 1],
            self::FACE_B => [0, 0, -1],
            default => throw new InvalidArgumentException("Invalid face: {$face}"),
        };
    }

    /**
     * Rotate a 3D vector about a unit axis by an angle (radians) via
     * Rodrigues' formula.
     *
     * @param  array{0:int, 1:int, 2:int}|array{0:float,1:float,2:float}  $vec
     * @param  array{0:int, 1:int, 2:int}  $axis
     * @return array{0:float,1:float,2:float}
     */
    private static function rotateVector(array $vec, array $axis, float $angle): array
    {
        $cos = cos($angle);
        $sin = sin($angle);
        $dot = $vec[0] * $axis[0] + $vec[1] * $axis[1] + $vec[2] * $axis[2];
        $cross = [
            $axis[1] * $vec[2] - $axis[2] * $vec[1],
            $axis[2] * $vec[0] - $axis[0] * $vec[2],
            $axis[0] * $vec[1] - $axis[1] * $vec[0],
        ];

        return [
            $vec[0] * $cos + $cross[0] * $sin + $axis[0] * $dot * (1 - $cos),
            $vec[1] * $cos + $cross[1] * $sin + $axis[1] * $dot * (1 - $cos),
            $vec[2] * $cos + $cross[2] * $sin + $axis[2] * $dot * (1 - $cos),
        ];
    }

    /**
     * Reverse-lookup key for a sticker: rounded lattice position + rounded normal.
     *
     * Rounding handles floating-point drift from rotateVector.
     *
     * @param  array{0:int, 1:int, 2:int}|array{0:float,1:float,2:float}  $pos
     * @param  array{0:int, 1:int, 2:int}|array{0:float,1:float,2:float}  $normal
     */
    private static function positionKey(array $pos, array $normal): string
    {
        return (int) round($pos[0]).','.(int) round($pos[1]).','.(int) round($pos[2]).
               '|'.(int) round($normal[0]).','.(int) round($normal[1]).','.(int) round($normal[2]);
    }
}
