<?php

namespace Tests\Unit;

use App\Services\OctahedronCube;
use PHPUnit\Framework\TestCase;

class OctahedronCubeTest extends TestCase
{
    public function test_initial_marks_are_72_nulls(): void
    {
        $marks = OctahedronCube::initialMarks();
        $this->assertCount(72, $marks);
        foreach ($marks as $m) {
            $this->assertNull($m);
        }
    }

    public function test_index_of_and_face_slot_are_inverses(): void
    {
        for ($f = 0; $f < 8; $f++) {
            for ($s = 0; $s < 9; $s++) {
                $i = OctahedronCube::indexOf($f, $s);
                $this->assertSame([$f, $s], OctahedronCube::faceSlot($i));
            }
        }
        $this->assertSame(71, OctahedronCube::indexOf(7, 8));
    }

    public function test_face_vertices_form_8_triangles_using_all_6_vertices(): void
    {
        $faces = OctahedronCube::faceVertices();
        $this->assertCount(8, $faces);
        $vertexUsage = [];
        foreach ($faces as $face) {
            $this->assertCount(3, $face);
            foreach ($face as $v) {
                $this->assertGreaterThanOrEqual(0, $v);
                $this->assertLessThan(6, $v);
                $vertexUsage[$v] = ($vertexUsage[$v] ?? 0) + 1;
            }
        }
        // Each vertex of a regular octahedron is shared by exactly 4 faces
        // (8 faces × 3 vertices per face = 24 incidences / 6 vertices).
        for ($v = 0; $v < 6; $v++) {
            $this->assertSame(4, $vertexUsage[$v] ?? 0, "Vertex {$v} should belong to exactly 4 faces");
        }
    }

    public function test_adjacency_is_symmetric(): void
    {
        $adj = OctahedronCube::adjacency();
        $this->assertCount(8, $adj);
        for ($f = 0; $f < 8; $f++) {
            $this->assertCount(3, $adj[$f]);
            // Every face in the adjacency list of F must also list F as adjacent.
            foreach ($adj[$f] as $g) {
                $this->assertContains($f, $adj[$g], "Face {$g} should list {$f} as adjacent (mirror of {$f}→{$g})");
            }
            // For an octahedron, each face has exactly 3 distinct neighbors.
            $unique = array_unique($adj[$f]);
            $this->assertCount(3, $unique, "Face {$f}'s 3 neighbors should all be distinct");
            $this->assertNotContains($f, $unique, "Face {$f} should not list itself as adjacent");
        }
    }

    public function test_each_cw_move_is_order_three(): void
    {
        for ($f = 0; $f < 8; $f++) {
            $marks = $this->uniqueMarks();
            $after = $marks;
            for ($i = 0; $i < 3; $i++) {
                $after = OctahedronCube::apply($f, 'cw', $after);
            }
            $this->assertSame($marks, $after, "Face {$f} CW^3 is not the identity");
        }
    }

    public function test_each_ccw_move_is_order_three(): void
    {
        for ($f = 0; $f < 8; $f++) {
            $marks = $this->uniqueMarks();
            $after = $marks;
            for ($i = 0; $i < 3; $i++) {
                $after = OctahedronCube::apply($f, 'ccw', $after);
            }
            $this->assertSame($marks, $after, "Face {$f} CCW^3 is not the identity");
        }
    }

    public function test_cw_and_ccw_are_inverses(): void
    {
        for ($f = 0; $f < 8; $f++) {
            $marks = $this->uniqueMarks();

            $after = OctahedronCube::apply($f, 'ccw', OctahedronCube::apply($f, 'cw', $marks));
            $this->assertSame($marks, $after, "Face {$f} CW then CCW is not identity");

            $after2 = OctahedronCube::apply($f, 'cw', OctahedronCube::apply($f, 'ccw', $marks));
            $this->assertSame($marks, $after2, "Face {$f} CCW then CW is not identity");
        }
    }

    public function test_cw_moves_corner_to_cw_neighbor_vertex_slot(): void
    {
        // Vertices are stored CCW from outside; CW rotation moves vertex i to
        // the position of vertex (i-1+3)%3 (its CW neighbor). So a mark at
        // face 0 slot 0 (corner at v[0]) ends up at slot 4 (v[2]) after CW.
        $marks = OctahedronCube::initialMarks();
        $src = OctahedronCube::indexOf(0, 0);
        $marks[$src] = 'CORNER_V0';

        $after = OctahedronCube::apply(0, 'cw', $marks);

        $expected = OctahedronCube::indexOf(0, 4);
        $this->assertSame('CORNER_V0', $after[$expected], 'Face 0 CW: corner at v[0] (slot 0) should move to slot 4 (v[2]) — the CW neighbor');

        // CCW should send it the other way (to slot 2, v[1]).
        $afterCcw = OctahedronCube::apply(0, 'ccw', $marks);
        $expectedCcw = OctahedronCube::indexOf(0, 2);
        $this->assertSame('CORNER_V0', $afterCcw[$expectedCcw], 'Face 0 CCW: corner at v[0] should move to slot 2 (v[1])');
    }

    public function test_face_rotation_displaces_three_cells_per_adjacent_face(): void
    {
        // Mark all 9 cells of one adjacent face of F=0 with unique values.
        // After F=0 CW, exactly 3 of those cells should have left the face,
        // and they should ALL land on a single other adjacent face of F=0.
        $adj = OctahedronCube::adjacency();
        $srcAdj = $adj[0][0];

        $marks = OctahedronCube::initialMarks();
        for ($s = 0; $s < 9; $s++) {
            $marks[OctahedronCube::indexOf($srcAdj, $s)] = "src_{$s}";
        }

        $after = OctahedronCube::apply(0, 'cw', $marks);

        $remainingOnSrc = 0;
        for ($s = 0; $s < 9; $s++) {
            $val = $after[OctahedronCube::indexOf($srcAdj, $s)];
            if (is_string($val) && str_starts_with($val, 'src_')) {
                $remainingOnSrc++;
            }
        }
        $this->assertSame(6, $remainingOnSrc, "Face {$srcAdj} should retain 6 of its 9 cells");

        $destinationFaces = [];
        for ($i = 0; $i < 72; $i++) {
            $val = $after[$i];
            if (is_string($val) && str_starts_with($val, 'src_')) {
                $destFace = intdiv($i, 9);
                if ($destFace !== $srcAdj) {
                    $destinationFaces[$destFace] = ($destinationFaces[$destFace] ?? 0) + 1;
                }
            }
        }
        $this->assertCount(1, $destinationFaces, 'All 3 displaced cells should land on a single other face');
        $destFace = (int) array_key_first($destinationFaces);
        $this->assertSame(3, $destinationFaces[$destFace]);
        $this->assertContains($destFace, $adj[0], "Destination face {$destFace} must be an adjacent face of face 0");
    }

    public function test_each_rotation_permutes_exactly_18_cells(): void
    {
        // Sanity: a face rotation should move all 9 of F's cells (3 orbits of 3)
        // plus 3 cells × 3 adjacent faces = 9. Total 18 moving cells.
        for ($f = 0; $f < 8; $f++) {
            $marks = $this->uniqueMarks();
            $after = OctahedronCube::apply($f, 'cw', $marks);
            $moved = 0;
            for ($i = 0; $i < 72; $i++) {
                if ($after[$i] !== $marks[$i]) {
                    $moved++;
                }
            }
            $this->assertSame(18, $moved, "Face {$f} CW should permute exactly 18 cells");
        }
    }

    public function test_each_rotation_is_a_bijection(): void
    {
        $perms = OctahedronCube::permutations();
        $this->assertCount(16, $perms);
        foreach ($perms as $key => $perm) {
            $this->assertCount(72, $perm, "Perm {$key} should have 72 entries");
            $sources = array_unique($perm);
            $this->assertCount(72, $sources, "Perm {$key} is not a bijection (duplicate sources)");
            sort($sources);
            $this->assertSame(range(0, 71), $sources, "Perm {$key} does not cover all 72 source indices");
        }
    }

    public function test_winning_lines_total_48(): void
    {
        $this->assertCount(48, OctahedronCube::lines());
        foreach (OctahedronCube::lines() as $line) {
            $this->assertCount(3, $line);
            $faces = array_map(fn ($i) => intdiv($i, 9), $line);
            $this->assertCount(1, array_unique($faces), 'All cells in a line must be on the same face');
            // No down-triangle (slot 6,7,8) ever appears in a line.
            foreach ($line as $i) {
                $slot = $i % 9;
                $this->assertLessThan(6, $slot, 'Down-triangle slot must not appear in any winning line');
            }
        }
    }

    public function test_winning_lines_detects_perimeter_triple(): void
    {
        $marks = OctahedronCube::initialMarks();
        // Face 0, slots 0, 1, 2 (corner-edge-corner perimeter triple)
        $marks[OctahedronCube::indexOf(0, 0)] = 'X';
        $marks[OctahedronCube::indexOf(0, 1)] = 'X';
        $marks[OctahedronCube::indexOf(0, 2)] = 'X';

        $lines = OctahedronCube::winningLines($marks);
        $this->assertNotEmpty($lines);
        $this->assertSame('X', $lines[0]['player']);
        $this->assertSame(0, $lines[0]['face']);
    }

    public function test_winning_lines_detects_wraparound_triple(): void
    {
        $marks = OctahedronCube::initialMarks();
        // Slots 4, 5, 0 wrap around the 6-cell perimeter ring.
        $marks[OctahedronCube::indexOf(0, 4)] = 'O';
        $marks[OctahedronCube::indexOf(0, 5)] = 'O';
        $marks[OctahedronCube::indexOf(0, 0)] = 'O';

        $lines = OctahedronCube::winningLines($marks);
        $this->assertNotEmpty($lines);
        $this->assertSame('O', $lines[0]['player']);
    }

    public function test_two_in_a_row_is_not_a_win(): void
    {
        $marks = OctahedronCube::initialMarks();
        $marks[OctahedronCube::indexOf(7, 1)] = 'X';
        $marks[OctahedronCube::indexOf(7, 2)] = 'X';

        $this->assertSame([], OctahedronCube::winningLines($marks));
    }

    public function test_mixed_triple_is_not_a_win(): void
    {
        $marks = OctahedronCube::initialMarks();
        $marks[OctahedronCube::indexOf(2, 0)] = 'X';
        $marks[OctahedronCube::indexOf(2, 1)] = 'O';
        $marks[OctahedronCube::indexOf(2, 2)] = 'X';

        $this->assertSame([], OctahedronCube::winningLines($marks));
    }

    public function test_is_complete_ignores_down_triangles(): void
    {
        $marks = OctahedronCube::initialMarks();
        $this->assertFalse(OctahedronCube::isComplete($marks));

        // Fill all 48 perimeter cells; leave the 24 down-triangles null.
        for ($f = 0; $f < 8; $f++) {
            for ($s = 0; $s < 6; $s++) {
                $marks[OctahedronCube::indexOf($f, $s)] = 'X';
            }
        }
        $this->assertTrue(OctahedronCube::isComplete($marks));

        // Removing one playable cell should make it incomplete again.
        $marks[OctahedronCube::indexOf(2, 3)] = null;
        $this->assertFalse(OctahedronCube::isComplete($marks));
    }

    public function test_is_playable_marks_correct_slots(): void
    {
        $playable = [0, 1, 2, 3, 4, 5];
        $dead = [6, 7, 8];
        foreach ($playable as $s) {
            $this->assertTrue(OctahedronCube::isPlayable($s), "Slot {$s} should be playable");
        }
        foreach ($dead as $s) {
            $this->assertFalse(OctahedronCube::isPlayable($s), "Slot {$s} should not be playable");
        }
    }

    public function test_apply_rejects_invalid_face(): void
    {
        $marks = OctahedronCube::initialMarks();

        $this->expectException(\InvalidArgumentException::class);
        OctahedronCube::apply(8, 'cw', $marks);
    }

    public function test_apply_rejects_invalid_direction(): void
    {
        $marks = OctahedronCube::initialMarks();

        $this->expectException(\InvalidArgumentException::class);
        OctahedronCube::apply(0, 'spin', $marks);
    }

    /**
     * @return list<string>
     */
    private function uniqueMarks(): array
    {
        $marks = [];
        for ($i = 0; $i < 72; $i++) {
            $marks[] = 'm'.$i;
        }

        return $marks;
    }
}
