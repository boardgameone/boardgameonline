<?php

namespace Tests\Unit;

use App\Services\RubikCube;
use PHPUnit\Framework\TestCase;

class RubikCubeTest extends TestCase
{
    public function test_initial_marks_are_54_nulls(): void
    {
        $marks = RubikCube::initialMarks();
        $this->assertCount(54, $marks);
        foreach ($marks as $m) {
            $this->assertNull($m);
        }
    }

    public function test_index_of_and_face_row_col_are_inverses(): void
    {
        for ($f = 0; $f < 6; $f++) {
            for ($r = 0; $r < 3; $r++) {
                for ($c = 0; $c < 3; $c++) {
                    $i = RubikCube::indexOf($f, $r, $c);
                    $this->assertSame([$f, $r, $c], RubikCube::faceRowCol($i));
                }
            }
        }
        $this->assertSame(53, RubikCube::indexOf(RubikCube::FACE_B, 2, 2));
    }

    public function test_all_moves_are_order_four(): void
    {
        foreach (RubikCube::MOVES as $move) {
            $marks = $this->uniqueMarks();
            $after = RubikCube::apply($move, RubikCube::apply($move, RubikCube::apply($move, RubikCube::apply($move, $marks))));
            $this->assertSame($marks, $after, "Move {$move}^4 is not the identity");
        }
    }

    public function test_each_move_and_inverse_cancel(): void
    {
        $pairs = ['U', 'D', 'L', 'R', 'F', 'B'];
        foreach ($pairs as $move) {
            $inverse = $move."'";
            $marks = $this->uniqueMarks();

            $after1 = RubikCube::apply($inverse, RubikCube::apply($move, $marks));
            $this->assertSame($marks, $after1, "{$move} then {$inverse} is not identity");

            $after2 = RubikCube::apply($move, RubikCube::apply($inverse, $marks));
            $this->assertSame($marks, $after2, "{$inverse} then {$move} is not identity");
        }
    }

    public function test_center_sticker_is_fixed_under_its_own_face_turn(): void
    {
        // Each face's center sticker (row=1, col=1) stays in place under
        // a rotation of that face.
        $faceToMove = [
            RubikCube::FACE_U => 'U',
            RubikCube::FACE_D => 'D',
            RubikCube::FACE_L => 'L',
            RubikCube::FACE_R => 'R',
            RubikCube::FACE_F => 'F',
            RubikCube::FACE_B => 'B',
        ];

        foreach ($faceToMove as $face => $move) {
            $marks = RubikCube::initialMarks();
            $centerIdx = RubikCube::indexOf($face, 1, 1);
            $marks[$centerIdx] = 'X';

            $after = RubikCube::apply($move, $marks);
            $this->assertSame('X', $after[$centerIdx], "Center of face {$face} moved under {$move}");

            // No other sticker should have a mark either (only one sticker marked, and it's a center).
            $markedCount = 0;
            foreach ($after as $m) {
                if ($m !== null) {
                    $markedCount++;
                }
            }
            $this->assertSame(1, $markedCount);
        }
    }

    public function test_stickers_outside_rotating_layer_are_untouched(): void
    {
        // Place a mark on the D face center (far from U layer), apply U, verify it stays.
        $marks = RubikCube::initialMarks();
        $dCenter = RubikCube::indexOf(RubikCube::FACE_D, 1, 1);
        $marks[$dCenter] = 'O';

        $after = RubikCube::apply('U', $marks);
        $this->assertSame('O', $after[$dCenter]);

        // And a mark on an F-face middle row (not in U layer) stays.
        $fMiddle = RubikCube::indexOf(RubikCube::FACE_F, 1, 0);
        $marks2 = RubikCube::initialMarks();
        $marks2[$fMiddle] = 'X';

        $after2 = RubikCube::apply('U', $marks2);
        $this->assertSame('X', $after2[$fMiddle]);
    }

    public function test_mark_on_rotating_face_stays_on_that_face(): void
    {
        // A mark on any U-face sticker should remain on the U face after U.
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 0, 0)] = 'X';

        $after = RubikCube::apply('U', $marks);

        // Find where the X ended up
        $xIdx = null;
        foreach ($after as $i => $m) {
            if ($m === 'X') {
                $xIdx = $i;
                break;
            }
        }

        $this->assertNotNull($xIdx);
        [$face] = RubikCube::faceRowCol($xIdx);
        $this->assertSame(RubikCube::FACE_U, $face, 'U-face mark should stay on U face after U');
    }

    public function test_u_move_cycles_top_row_stickers_across_sides(): void
    {
        // A mark on a side face's top row (in the U layer) should move to
        // ANOTHER side face's top row after U. It must not stay on the same
        // face, and it must not end up on the U or D face.
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 1)] = 'X';

        $after = RubikCube::apply('U', $marks);

        $xIdx = null;
        foreach ($after as $i => $m) {
            if ($m === 'X') {
                $xIdx = $i;
                break;
            }
        }

        $this->assertNotNull($xIdx);
        [$face, $row] = RubikCube::faceRowCol($xIdx);
        $this->assertNotSame(RubikCube::FACE_F, $face, 'F top-row mark should move to a different face');
        $this->assertContains($face, [
            RubikCube::FACE_L,
            RubikCube::FACE_R,
            RubikCube::FACE_B,
        ], 'Mark should end up on L, R, or B (a side face, not U or D)');
        $this->assertSame(0, $row, 'Mark should remain on the top row of its new side face');
    }

    public function test_returning_to_start_after_full_cycle_of_12_move_sequence(): void
    {
        // The sequence (R U R' U') repeated 6 times returns a solved cube
        // to its solved state. Tests a non-trivial commutator sequence.
        $marks = $this->uniqueMarks();
        $sequence = ['R', 'U', "R'", "U'"];

        for ($i = 0; $i < 6; $i++) {
            foreach ($sequence as $move) {
                $marks = RubikCube::apply($move, $marks);
            }
        }

        $this->assertSame($this->uniqueMarks(), $marks, '(R U R\' U\')^6 should be the identity');
    }

    public function test_winning_lines_detects_row(): void
    {
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 0)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 1)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 2)] = 'X';

        $lines = RubikCube::winningLines($marks);
        $this->assertCount(1, $lines);
        $this->assertSame(RubikCube::FACE_F, $lines[0]['face']);
        $this->assertSame('X', $lines[0]['player']);
    }

    public function test_winning_lines_detects_column(): void
    {
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_R, 0, 1)] = 'O';
        $marks[RubikCube::indexOf(RubikCube::FACE_R, 1, 1)] = 'O';
        $marks[RubikCube::indexOf(RubikCube::FACE_R, 2, 1)] = 'O';

        $lines = RubikCube::winningLines($marks);
        $this->assertCount(1, $lines);
        $this->assertSame('O', $lines[0]['player']);
    }

    public function test_winning_lines_detects_diagonal(): void
    {
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 0, 0)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 1, 1)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 2, 2)] = 'X';

        $lines = RubikCube::winningLines($marks);
        $this->assertCount(1, $lines);
    }

    public function test_winning_lines_detects_anti_diagonal(): void
    {
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 0, 2)] = 'O';
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 1, 1)] = 'O';
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 2, 0)] = 'O';

        $lines = RubikCube::winningLines($marks);
        $this->assertCount(1, $lines);
    }

    public function test_winning_lines_does_not_detect_cross_face_pseudo_line(): void
    {
        // Pick three stickers on three different faces. Even if they'd "line up"
        // in 3D, they must not count — wins are per-face only.
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 0)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_U, 2, 0)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_L, 0, 2)] = 'X';

        $this->assertSame([], RubikCube::winningLines($marks));
    }

    public function test_winning_lines_detects_both_players_simultaneously(): void
    {
        $marks = RubikCube::initialMarks();
        // X on F top row
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 0)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 1)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 2)] = 'X';
        // O on B top row
        $marks[RubikCube::indexOf(RubikCube::FACE_B, 0, 0)] = 'O';
        $marks[RubikCube::indexOf(RubikCube::FACE_B, 0, 1)] = 'O';
        $marks[RubikCube::indexOf(RubikCube::FACE_B, 0, 2)] = 'O';

        $lines = RubikCube::winningLines($marks);
        $this->assertCount(2, $lines);
        $players = collect($lines)->pluck('player')->sort()->values()->all();
        $this->assertSame(['O', 'X'], $players);
    }

    public function test_mixed_line_is_not_a_win(): void
    {
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 1, 0)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 1, 1)] = 'O';
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 1, 2)] = 'X';

        $this->assertSame([], RubikCube::winningLines($marks));
    }

    public function test_two_in_a_row_is_not_a_win(): void
    {
        $marks = RubikCube::initialMarks();
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 0)] = 'X';
        $marks[RubikCube::indexOf(RubikCube::FACE_F, 0, 1)] = 'X';

        $this->assertSame([], RubikCube::winningLines($marks));
    }

    public function test_lines_are_48_total(): void
    {
        $this->assertCount(48, RubikCube::lines());
    }

    public function test_is_complete(): void
    {
        $marks = RubikCube::initialMarks();
        $this->assertFalse(RubikCube::isComplete($marks));

        $full = array_fill(0, 54, 'X');
        $this->assertTrue(RubikCube::isComplete($full));

        $almostFull = array_fill(0, 54, 'X');
        $almostFull[30] = null;
        $this->assertFalse(RubikCube::isComplete($almostFull));
    }

    public function test_apply_rejects_unknown_move(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        RubikCube::apply('X2', RubikCube::initialMarks());
    }

    public function test_permutations_contain_all_12_moves(): void
    {
        $perms = RubikCube::permutations();
        $this->assertCount(12, $perms);
        foreach (RubikCube::MOVES as $m) {
            $this->assertArrayHasKey($m, $perms);
            $this->assertCount(54, $perms[$m]);
        }
    }

    /**
     * Helper: 54-element array where each position holds a unique marker like "m0", "m1", ...
     *
     * @return list<string>
     */
    private function uniqueMarks(): array
    {
        $marks = [];
        for ($i = 0; $i < 54; $i++) {
            $marks[] = 'm'.$i;
        }

        return $marks;
    }
}
