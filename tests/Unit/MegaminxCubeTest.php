<?php

namespace Tests\Unit;

use App\Services\MegaminxCube;
use PHPUnit\Framework\TestCase;

class MegaminxCubeTest extends TestCase
{
    public function test_initial_marks_are_132_nulls(): void
    {
        $marks = MegaminxCube::initialMarks();
        $this->assertCount(132, $marks);
        foreach ($marks as $m) {
            $this->assertNull($m);
        }
    }

    public function test_index_of_and_face_slot_are_inverses(): void
    {
        for ($f = 0; $f < 12; $f++) {
            for ($s = 0; $s < 11; $s++) {
                $i = MegaminxCube::indexOf($f, $s);
                $this->assertSame([$f, $s], MegaminxCube::faceSlot($i));
            }
        }
        $this->assertSame(131, MegaminxCube::indexOf(11, 10));
    }

    public function test_face_vertices_form_12_pentagons_using_all_20_vertices(): void
    {
        $faces = MegaminxCube::faceVertices();
        $this->assertCount(12, $faces);
        $vertexUsage = [];
        foreach ($faces as $face) {
            $this->assertCount(5, $face);
            foreach ($face as $v) {
                $this->assertGreaterThanOrEqual(0, $v);
                $this->assertLessThan(20, $v);
                $vertexUsage[$v] = ($vertexUsage[$v] ?? 0) + 1;
            }
        }
        // Each vertex of a regular dodecahedron is shared by exactly 3 faces.
        for ($v = 0; $v < 20; $v++) {
            $this->assertSame(3, $vertexUsage[$v] ?? 0, "Vertex {$v} should belong to exactly 3 faces");
        }
    }

    public function test_adjacency_is_symmetric(): void
    {
        $adj = MegaminxCube::adjacency();
        $this->assertCount(12, $adj);
        for ($f = 0; $f < 12; $f++) {
            $this->assertCount(5, $adj[$f]);
            // Every face listed as adjacent to F must also list F as adjacent.
            foreach ($adj[$f] as $g) {
                $this->assertContains($f, $adj[$g], "Face {$g} should list {$f} as adjacent (mirror of {$f}→{$g})");
            }
        }
    }

    public function test_each_cw_move_is_order_five(): void
    {
        for ($f = 0; $f < 12; $f++) {
            $marks = $this->uniqueMarks();
            $after = $marks;
            for ($i = 0; $i < 5; $i++) {
                $after = MegaminxCube::apply($f, 'cw', $after);
            }
            $this->assertSame($marks, $after, "Face {$f} CW^5 is not the identity");
        }
    }

    public function test_each_ccw_move_is_order_five(): void
    {
        for ($f = 0; $f < 12; $f++) {
            $marks = $this->uniqueMarks();
            $after = $marks;
            for ($i = 0; $i < 5; $i++) {
                $after = MegaminxCube::apply($f, 'ccw', $after);
            }
            $this->assertSame($marks, $after, "Face {$f} CCW^5 is not the identity");
        }
    }

    public function test_cw_and_ccw_are_inverses(): void
    {
        for ($f = 0; $f < 12; $f++) {
            $marks = $this->uniqueMarks();

            $after = MegaminxCube::apply($f, 'ccw', MegaminxCube::apply($f, 'cw', $marks));
            $this->assertSame($marks, $after, "Face {$f} CW then CCW is not identity");

            $after2 = MegaminxCube::apply($f, 'cw', MegaminxCube::apply($f, 'ccw', $marks));
            $this->assertSame($marks, $after2, "Face {$f} CCW then CW is not identity");
        }
    }

    public function test_center_sticker_is_fixed_under_its_own_face_rotation(): void
    {
        for ($f = 0; $f < 12; $f++) {
            $marks = MegaminxCube::initialMarks();
            $centerIdx = MegaminxCube::indexOf($f, 0);
            $marks[$centerIdx] = 'CENTER';

            $afterCw = MegaminxCube::apply($f, 'cw', $marks);
            $this->assertSame('CENTER', $afterCw[$centerIdx], "Center of face {$f} moved under CW");

            $afterCcw = MegaminxCube::apply($f, 'ccw', $marks);
            $this->assertSame('CENTER', $afterCcw[$centerIdx], "Center of face {$f} moved under CCW");

            // No other slot got a value.
            $marked = 0;
            foreach ($afterCw as $m) {
                if ($m !== null) {
                    $marked++;
                }
            }
            $this->assertSame(1, $marked, "Stray marks after rotating face {$f} CW");
        }
    }

    public function test_cw_advances_corner_to_next_vertex_slot(): void
    {
        // Spot check (advisor recommendation): a unique value at face 0 slot 1
        // (corner at v[0]) must end up at face 0 slot 3 (corner at v[1]) after one CW.
        $marks = MegaminxCube::initialMarks();
        $src = MegaminxCube::indexOf(0, 1);
        $marks[$src] = 'CORNER_V0';

        $after = MegaminxCube::apply(0, 'cw', $marks);

        $expected = MegaminxCube::indexOf(0, 3);
        $this->assertSame('CORNER_V0', $after[$expected], 'Face 0 CW: corner at v[0] (slot 1) should move to slot 3 (v[1])');
        $this->assertNull($after[$src], 'Source slot should now hold a different value (or null since no other mark was set)');
    }

    public function test_cw_moves_adjacent_face_corner_to_next_adjacent_face(): void
    {
        // Spot check (advisor recommendation): mark the "near-F corner_left" cell on
        // adjacency[0][0]; after F=0 CW, that mark must appear at the corresponding
        // near-F corner_left cell on adjacency[0][1].
        $adj = MegaminxCube::adjacency();
        $srcAdj = $adj[0][0];
        $dstAdj = $adj[0][1];
        $this->assertNotSame($srcAdj, $dstAdj, 'Adjacent faces 0 and 1 of face 0 must differ');

        // We don't know srcK/dstK from outside the service, so look up the slot by
        // searching: build a uniquely-marked board, apply the rotation, and assert
        // exactly ONE sticker from $srcAdj's near-F cells ended up on $dstAdj.

        // Mark all 11 cells of $srcAdj with face-encoded values, leave the rest null.
        $marks = MegaminxCube::initialMarks();
        for ($s = 0; $s < 11; $s++) {
            $marks[MegaminxCube::indexOf($srcAdj, $s)] = "src_{$s}";
        }

        $after = MegaminxCube::apply(0, 'cw', $marks);

        // Exactly 3 of $srcAdj's stickers should have moved off $srcAdj and onto $dstAdj
        // (the 3 cells touching face 0's perimeter).
        $movedToDst = [];
        for ($s = 0; $s < 11; $s++) {
            $val = $after[MegaminxCube::indexOf($dstAdj, $s)];
            if (is_string($val) && str_starts_with($val, 'src_')) {
                $movedToDst[] = $val;
            }
        }
        $this->assertCount(3, $movedToDst, "Exactly 3 cells of face {$srcAdj} should move to face {$dstAdj} when face 0 rotates CW");

        // And exactly 3 of $srcAdj's slots should now be null (the "near-F" 3 cells
        // that gave away their values), with the other 8 still holding "src_*".
        $remainingOnSrc = 0;
        for ($s = 0; $s < 11; $s++) {
            $val = $after[MegaminxCube::indexOf($srcAdj, $s)];
            if (is_string($val) && str_starts_with($val, 'src_')) {
                $remainingOnSrc++;
            }
        }
        $this->assertSame(8, $remainingOnSrc, "Face {$srcAdj} should retain 8 of its original 11 cells");
    }

    public function test_each_rotation_permutes_exactly_25_cells(): void
    {
        // Sanity: a face rotation should move 11 of F's cells minus the center (10 moving on F)
        // plus 3 cells × 5 adjacent faces = 15. Total 25 moving cells.
        for ($f = 0; $f < 12; $f++) {
            $marks = $this->uniqueMarks();
            $after = MegaminxCube::apply($f, 'cw', $marks);
            $moved = 0;
            for ($i = 0; $i < 132; $i++) {
                if ($after[$i] !== $marks[$i]) {
                    $moved++;
                }
            }
            $this->assertSame(25, $moved, "Face {$f} CW should permute exactly 25 cells");
        }
    }

    public function test_each_rotation_is_a_bijection(): void
    {
        // Every permutation must be a bijection: 132 distinct sources covering every dst slot.
        $perms = MegaminxCube::permutations();
        $this->assertCount(24, $perms);
        foreach ($perms as $key => $perm) {
            $this->assertCount(132, $perm, "Perm {$key} should have 132 entries");
            $sources = array_unique($perm);
            $this->assertCount(132, $sources, "Perm {$key} is not a bijection (duplicate sources)");
            sort($sources);
            $this->assertSame(range(0, 131), $sources, "Perm {$key} does not cover all 132 source indices");
        }
    }

    public function test_winning_lines_total_120(): void
    {
        $this->assertCount(120, MegaminxCube::lines());
        // Each line is 3 indices on the same face.
        foreach (MegaminxCube::lines() as $line) {
            $this->assertCount(3, $line);
            $faces = array_map(fn ($i) => intdiv($i, 11), $line);
            $this->assertCount(1, array_unique($faces), 'All cells in a line must be on the same face');
            // No center (slot 0) ever appears in a line.
            foreach ($line as $i) {
                $this->assertNotSame(0, $i % 11, 'Center slot must not appear in any winning line');
            }
        }
    }

    public function test_winning_lines_detects_perimeter_triple(): void
    {
        $marks = MegaminxCube::initialMarks();
        // Face 0, slots 1, 2, 3 (corner-edge-corner perimeter triple)
        $marks[MegaminxCube::indexOf(0, 1)] = 'X';
        $marks[MegaminxCube::indexOf(0, 2)] = 'X';
        $marks[MegaminxCube::indexOf(0, 3)] = 'X';

        $lines = MegaminxCube::winningLines($marks);
        $this->assertNotEmpty($lines);
        $this->assertSame('X', $lines[0]['player']);
        $this->assertSame(0, $lines[0]['face']);
    }

    public function test_winning_lines_detects_wraparound_triple(): void
    {
        $marks = MegaminxCube::initialMarks();
        // Slots 9, 10, 1 wrap around the perimeter
        $marks[MegaminxCube::indexOf(0, 9)] = 'O';
        $marks[MegaminxCube::indexOf(0, 10)] = 'O';
        $marks[MegaminxCube::indexOf(0, 1)] = 'O';

        $lines = MegaminxCube::winningLines($marks);
        $this->assertNotEmpty($lines);
        $this->assertSame('O', $lines[0]['player']);
    }

    public function test_two_in_a_row_is_not_a_win(): void
    {
        $marks = MegaminxCube::initialMarks();
        $marks[MegaminxCube::indexOf(3, 1)] = 'X';
        $marks[MegaminxCube::indexOf(3, 2)] = 'X';

        $this->assertSame([], MegaminxCube::winningLines($marks));
    }

    public function test_mixed_triple_is_not_a_win(): void
    {
        $marks = MegaminxCube::initialMarks();
        $marks[MegaminxCube::indexOf(2, 1)] = 'X';
        $marks[MegaminxCube::indexOf(2, 2)] = 'O';
        $marks[MegaminxCube::indexOf(2, 3)] = 'X';

        $this->assertSame([], MegaminxCube::winningLines($marks));
    }

    public function test_is_complete_ignores_centers(): void
    {
        $marks = MegaminxCube::initialMarks();
        $this->assertFalse(MegaminxCube::isComplete($marks));

        // Fill all playable cells but leave centers null
        for ($f = 0; $f < 12; $f++) {
            for ($s = 1; $s < 11; $s++) {
                $marks[MegaminxCube::indexOf($f, $s)] = 'X';
            }
        }
        $this->assertTrue(MegaminxCube::isComplete($marks));

        // Removing one playable cell should make it incomplete again.
        $marks[MegaminxCube::indexOf(5, 7)] = null;
        $this->assertFalse(MegaminxCube::isComplete($marks));
    }

    public function test_apply_rejects_invalid_face_or_direction(): void
    {
        $marks = MegaminxCube::initialMarks();

        $this->expectException(\InvalidArgumentException::class);
        MegaminxCube::apply(12, 'cw', $marks);
    }

    public function test_apply_rejects_invalid_direction(): void
    {
        $marks = MegaminxCube::initialMarks();

        $this->expectException(\InvalidArgumentException::class);
        MegaminxCube::apply(0, 'spin', $marks);
    }

    /**
     * Helper: 132-element array where each position holds a unique marker like "m0", "m1", ...
     *
     * @return list<string>
     */
    private function uniqueMarks(): array
    {
        $marks = [];
        for ($i = 0; $i < 132; $i++) {
            $marks[] = 'm'.$i;
        }

        return $marks;
    }
}
