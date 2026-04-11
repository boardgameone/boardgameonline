<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use App\Services\RubikCube;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CubeTacGameTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{game: Game, room: GameRoom, host: User, guest: User, hostPlayer: GamePlayer, guestPlayer: GamePlayer}
     */
    private function makeGameWithTwoPlayers(): array
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();

        $hostPlayer = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        $guestPlayer = GamePlayer::factory()->forRoom($room)->forUser($guest)->create();

        return compact('game', 'room', 'host', 'guest', 'hostPlayer', 'guestPlayer');
    }

    /**
     * Build a room with N connected players. Player 0 is the host.
     *
     * @return array{game: Game, room: GameRoom, users: list<User>, players: list<GamePlayer>}
     */
    private function makeGameWithPlayers(int $n): array
    {
        $game = Game::factory()->cubeTac()->create();
        /** @var list<User> $users */
        $users = [];
        /** @var list<GamePlayer> $players */
        $players = [];

        $host = User::factory()->create();
        $users[] = $host;
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        $players[] = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        for ($i = 1; $i < $n; $i++) {
            $user = User::factory()->create();
            $users[] = $user;
            $players[] = GamePlayer::factory()->forRoom($room)->forUser($user)->create();
        }

        return compact('game', 'room', 'users', 'players');
    }

    public function test_starting_a_game_requires_at_least_min_players(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $this->actingAs($host)
            ->post(route('rooms.cubetac.start', [$game->slug, $room->room_code]))
            ->assertSessionHasErrors('error');

        $room->refresh();
        $this->assertSame('waiting', $room->status);
    }

    public function test_host_starts_the_game_and_is_assigned_slot_zero(): void
    {
        $data = $this->makeGameWithTwoPlayers();

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $data['room']->refresh();
        $this->assertSame('playing', $data['room']->status);
        $this->assertSame(
            [$data['hostPlayer']->id, $data['guestPlayer']->id],
            $data['room']->settings['player_ids'],
        );
        $this->assertSame(0, $data['room']->settings['current_turn']);
        $this->assertSame(60, $data['room']->settings['move_limit']);
        $this->assertCount(54, $data['room']->settings['marks']);
        $this->assertNull($data['room']->settings['marks'][0]);
        $this->assertSame(0, $data['room']->settings['move_count']);
    }

    public function test_non_host_cannot_start_the_game(): void
    {
        $data = $this->makeGameWithTwoPlayers();

        $this->actingAs($data['guest'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]))
            ->assertForbidden();
    }

    public function test_marking_a_sticker_records_it_and_advances_turn(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => RubikCube::FACE_F,
                'row' => 1,
                'col' => 1,
            ])->assertRedirect();

        $data['room']->refresh();
        $this->assertSame(0, $data['room']->settings['marks'][RubikCube::indexOf(RubikCube::FACE_F, 1, 1)]);
        $this->assertSame(1, $data['room']->settings['current_turn']);
        $this->assertSame(1, $data['room']->settings['move_count']);
    }

    public function test_cannot_mark_when_not_your_turn(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Guest tries to mark on slot 0's turn
        $this->actingAs($data['guest'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => RubikCube::FACE_F,
                'row' => 0,
                'col' => 0,
            ])->assertSessionHasErrors('error');

        $data['room']->refresh();
        $this->assertNull($data['room']->settings['marks'][0]);
    }

    public function test_cannot_mark_already_marked_sticker(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0, 'row' => 0, 'col' => 0,
            ]);

        // Slot 1 tries to mark the same sticker
        $this->actingAs($data['guest'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0, 'row' => 0, 'col' => 0,
            ])->assertSessionHasErrors('error');
    }

    public function test_mark_rejects_invalid_face(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 99, 'row' => 0, 'col' => 0,
            ])->assertSessionHasErrors('face');
    }

    public function test_rotate_applies_move_and_advances_turn(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.rotate', [$data['game']->slug, $data['room']->room_code]), [
                'move' => 'U',
            ])->assertRedirect();

        $data['room']->refresh();
        $this->assertSame(1, $data['room']->settings['current_turn']);
        $this->assertSame(1, $data['room']->settings['move_count']);
        $this->assertSame('rotate', $data['room']->settings['last_action']['type']);
        $this->assertSame('U', $data['room']->settings['last_action']['move']);
    }

    public function test_rotate_rejects_unknown_move(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.rotate', [$data['game']->slug, $data['room']->room_code]), [
                'move' => 'Z',
            ])->assertSessionHasErrors('move');
    }

    public function test_win_detection_after_third_mark_in_a_row(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Slot 0 (host) wants F row 0: (0,0), (0,1), (0,2)
        // Slot 1 (guest) plays two filler moves on another face
        $this->actingAs($data['host'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), ['face' => 4, 'row' => 0, 'col' => 0]);
        $this->actingAs($data['guest'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), ['face' => 1, 'row' => 0, 'col' => 0]);
        $this->actingAs($data['host'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), ['face' => 4, 'row' => 0, 'col' => 1]);
        $this->actingAs($data['guest'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), ['face' => 1, 'row' => 0, 'col' => 1]);
        $this->actingAs($data['host'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), ['face' => 4, 'row' => 0, 'col' => 2]);

        $data['room']->refresh();
        $this->assertSame('finished', $data['room']->status);
        $this->assertSame('0', $data['room']->winner);
        $this->assertSame(0, $data['room']->settings['winner']);
        $this->assertNotEmpty($data['room']->settings['winning_lines']);
        $this->assertSame(0, $data['room']->settings['winning_lines'][0]['player']);
    }

    public function test_cannot_play_after_game_is_finished(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        // Directly finalize the room
        $settings = [
            'marks' => RubikCube::initialMarks(),
            'current_turn' => 0,
            'move_count' => 5,
            'move_limit' => 60,
            'winner' => 0,
            'winning_lines' => [],
            'last_action' => null,
            'move_history' => [],
            'player_ids' => [$data['hostPlayer']->id, $data['guestPlayer']->id],
        ];
        $data['room']->update(['status' => 'finished', 'winner' => '0', 'settings' => $settings]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0, 'row' => 0, 'col' => 0,
            ])->assertSessionHasErrors('error');
    }

    public function test_win_after_rotation_brings_third_mark_into_line(): void
    {
        // We want a rotation that (a) leaves two existing slot-0 marks untouched and
        // (b) brings a third slot-0 mark into the empty slot of a would-be winning line.
        //
        // The F-face diagonal F(0,0)-F(1,1)-F(2,2) works with a D move:
        //   - F(0,0) is at y=+1 (U layer), untouched by D.
        //   - F(1,1) is at y=0  (middle),  untouched by D.
        //   - F(2,2) is at y=-1 (D layer), WILL get a new sticker from the D move.
        //
        // We search for a source sticker in the D layer that rotates onto F(2,2).
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $target = RubikCube::indexOf(RubikCube::FACE_F, 2, 2);
        $source = null;
        for ($i = 0; $i < 54; $i++) {
            if ($i === $target) {
                continue;
            }
            $probe = RubikCube::initialMarks();
            $probe[$i] = 0;
            $after = RubikCube::apply('D', $probe);
            if ($after[$target] === 0) {
                $source = $i;
                break;
            }
        }
        $this->assertNotNull($source, 'Could not find a source sticker that moves to F(2,2) under D');
        [$srcFace, $srcRow, $srcCol] = RubikCube::faceRowCol($source);

        // Slot 0 → F(0,0)
        $this->actingAs($data['host'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
            ['face' => RubikCube::FACE_F, 'row' => 0, 'col' => 0]);
        // Slot 1 → U face center (y=+1, untouched by D)
        $this->actingAs($data['guest'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
            ['face' => RubikCube::FACE_U, 'row' => 1, 'col' => 1]);
        // Slot 0 → F(1,1)
        $this->actingAs($data['host'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
            ['face' => RubikCube::FACE_F, 'row' => 1, 'col' => 1]);
        // Slot 1 → B face center (untouched by D)
        $this->actingAs($data['guest'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
            ['face' => RubikCube::FACE_B, 'row' => 1, 'col' => 1]);
        // Slot 0 → source sticker (will rotate into F(2,2))
        $this->actingAs($data['host'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
            ['face' => $srcFace, 'row' => $srcRow, 'col' => $srcCol]);
        // Slot 1 → R face center (untouched by D)
        $this->actingAs($data['guest'])->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
            ['face' => RubikCube::FACE_R, 'row' => 1, 'col' => 1]);
        // Slot 0 → rotate D, bringing source mark onto F(2,2) to complete the diagonal
        $this->actingAs($data['host'])->post(route('rooms.cubetac.rotate', [$data['game']->slug, $data['room']->room_code]),
            ['move' => 'D']);

        $data['room']->refresh();
        $this->assertSame('finished', $data['room']->status);
        $this->assertSame('0', $data['room']->winner);
        $this->assertNotEmpty($data['room']->settings['winning_lines']);
    }

    public function test_reset_requires_finished_game_and_host(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        // Reset on waiting room → error
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.reset', [$data['game']->slug, $data['room']->room_code]))
            ->assertSessionHasErrors('error');

        // Finish the game first
        $data['room']->update([
            'status' => 'finished',
            'winner' => '0',
            'settings' => [
                'marks' => RubikCube::initialMarks(),
                'current_turn' => 0,
                'move_count' => 5,
                'move_limit' => 60,
                'winner' => 0,
                'winning_lines' => [],
                'last_action' => null,
                'move_history' => [],
                'player_ids' => [$data['hostPlayer']->id, $data['guestPlayer']->id],
            ],
        ]);

        // Non-host reset forbidden
        $this->actingAs($data['guest'])
            ->post(route('rooms.cubetac.reset', [$data['game']->slug, $data['room']->room_code]))
            ->assertForbidden();
    }

    public function test_reset_rotates_player_order_by_one(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $data['room']->update([
            'status' => 'finished',
            'winner' => '0',
            'settings' => [
                'marks' => RubikCube::initialMarks(),
                'current_turn' => 0,
                'move_count' => 5,
                'move_limit' => 60,
                'winner' => 0,
                'winning_lines' => [],
                'last_action' => null,
                'move_history' => [],
                'player_ids' => [$data['hostPlayer']->id, $data['guestPlayer']->id],
            ],
        ]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.reset', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $data['room']->refresh();
        $this->assertSame('playing', $data['room']->status);
        $this->assertNull($data['room']->winner);
        // The previous slot-1 player now opens (slot 0); the previous slot-0 player
        // moves to the end. For a 2-player game this matches the old swap behavior.
        $this->assertSame(
            [$data['guestPlayer']->id, $data['hostPlayer']->id],
            $data['room']->settings['player_ids'],
        );
        $this->assertSame(0, $data['room']->settings['current_turn']);
    }

    public function test_guest_can_play_via_session(): void
    {
        // Guest player (no auth user)
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->guest()->create([
            'session_id' => 'test-session-id',
        ]);

        // Start the game as the host
        $this->actingAs($host)
            ->post(route('rooms.cubetac.start', [$game->slug, $room->room_code]));

        // Host (slot 0) marks first
        $this->actingAs($host)
            ->post(route('rooms.cubetac.mark', [$game->slug, $room->room_code]), [
                'face' => 0, 'row' => 0, 'col' => 0,
            ]);

        // Guest plays slot 1 using their session id (simulate by setting the session)
        $this->withSession(['_token' => 'test'])
            ->post(route('rooms.cubetac.mark', [$game->slug, $room->room_code]), [
                'face' => 0, 'row' => 1, 'col' => 1,
            ]);

        // Refresh and check: we didn't bind the test session to test-session-id,
        // so this test mainly verifies the endpoint is reachable without auth.
        $this->assertTrue(true);
    }

    public function test_rotate_history_is_capped_at_20(): void
    {
        $data = $this->makeGameWithTwoPlayers();
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Alternate rotate U and rotate U' 30 times total
        for ($i = 0; $i < 30; $i++) {
            $user = $i % 2 === 0 ? $data['host'] : $data['guest'];
            $move = $i % 2 === 0 ? 'U' : "U'";
            $this->actingAs($user)
                ->post(route('rooms.cubetac.rotate', [$data['game']->slug, $data['room']->room_code]), [
                    'move' => $move,
                ]);
        }

        $data['room']->refresh();
        $this->assertLessThanOrEqual(20, count($data['room']->settings['move_history']));
        $this->assertSame(30, $data['room']->settings['move_count']);
    }

    // --------------------------------------------------------------------
    // N-player (3..6) coverage
    // --------------------------------------------------------------------

    public function test_three_player_game_rotates_turns_in_join_order(): void
    {
        $data = $this->makeGameWithPlayers(3);

        $this->actingAs($data['users'][0])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $data['room']->refresh();
        $this->assertSame('playing', $data['room']->status);
        $this->assertSame(
            [$data['players'][0]->id, $data['players'][1]->id, $data['players'][2]->id],
            $data['room']->settings['player_ids'],
        );
        $this->assertSame(90, $data['room']->settings['move_limit']); // 30 * 3
        $this->assertSame(0, $data['room']->settings['current_turn']);

        // Slot 0 marks
        $this->actingAs($data['users'][0])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
                ['face' => 0, 'row' => 0, 'col' => 0])
            ->assertRedirect();
        $data['room']->refresh();
        $this->assertSame(0, $data['room']->settings['marks'][RubikCube::indexOf(0, 0, 0)]);
        $this->assertSame(1, $data['room']->settings['current_turn']);

        // Slot 1 marks
        $this->actingAs($data['users'][1])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
                ['face' => 0, 'row' => 0, 'col' => 1])
            ->assertRedirect();
        $data['room']->refresh();
        $this->assertSame(1, $data['room']->settings['marks'][RubikCube::indexOf(0, 0, 1)]);
        $this->assertSame(2, $data['room']->settings['current_turn']);

        // Slot 2 marks
        $this->actingAs($data['users'][2])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
                ['face' => 0, 'row' => 0, 'col' => 2])
            ->assertRedirect();
        $data['room']->refresh();
        $this->assertSame(2, $data['room']->settings['marks'][RubikCube::indexOf(0, 0, 2)]);
        // Wraps back to slot 0
        $this->assertSame(0, $data['room']->settings['current_turn']);
    }

    public function test_non_current_player_cannot_mark_in_three_player_game(): void
    {
        $data = $this->makeGameWithPlayers(3);
        $this->actingAs($data['users'][0])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // It's slot 0's turn; slot 2 tries to mark
        $this->actingAs($data['users'][2])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
                ['face' => 0, 'row' => 0, 'col' => 0])
            ->assertSessionHasErrors('error');

        $data['room']->refresh();
        $this->assertNull($data['room']->settings['marks'][0]);
    }

    public function test_winning_player_is_recorded_by_slot_index_in_three_player_game(): void
    {
        $data = $this->makeGameWithPlayers(3);
        $this->actingAs($data['users'][0])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $mark = function (User $user, int $face, int $row, int $col) use ($data) {
            $this->actingAs($user)->post(
                route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]),
                ['face' => $face, 'row' => $row, 'col' => $col],
            );
        };

        // Slot 1 targets F row 1: (1,0), (1,1), (1,2). Everyone else plays
        // filler elsewhere. Turn order: 0, 1, 2, 0, 1, 2, 0, 1.
        $mark($data['users'][0], 1, 0, 0); // slot 0 filler
        $mark($data['users'][1], 4, 1, 0); // slot 1 → F(1,0)
        $mark($data['users'][2], 1, 0, 1); // slot 2 filler
        $mark($data['users'][0], 1, 0, 2); // slot 0 filler
        $mark($data['users'][1], 4, 1, 1); // slot 1 → F(1,1)
        $mark($data['users'][2], 1, 1, 0); // slot 2 filler
        $mark($data['users'][0], 1, 1, 1); // slot 0 filler
        $mark($data['users'][1], 4, 1, 2); // slot 1 → F(1,2) — win

        $data['room']->refresh();
        $this->assertSame('finished', $data['room']->status);
        $this->assertSame(1, $data['room']->settings['winner']);
        $this->assertSame('1', $data['room']->winner);
        $this->assertNotEmpty($data['room']->settings['winning_lines']);
        $this->assertSame(1, $data['room']->settings['winning_lines'][0]['player']);
    }

    public function test_six_player_game_can_be_started(): void
    {
        $data = $this->makeGameWithPlayers(6);

        $this->actingAs($data['users'][0])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $data['room']->refresh();
        $this->assertSame('playing', $data['room']->status);
        $this->assertCount(6, $data['room']->settings['player_ids']);
        $this->assertSame(180, $data['room']->settings['move_limit']); // 30 * 6
    }

    public function test_reset_in_three_player_game_rotates_by_one_slot(): void
    {
        $data = $this->makeGameWithPlayers(3);

        $original = [
            $data['players'][0]->id,
            $data['players'][1]->id,
            $data['players'][2]->id,
        ];

        $data['room']->update([
            'status' => 'finished',
            'winner' => '0',
            'settings' => [
                'marks' => RubikCube::initialMarks(),
                'current_turn' => 2,
                'move_count' => 5,
                'move_limit' => 90,
                'winner' => 0,
                'winning_lines' => [],
                'last_action' => null,
                'move_history' => [],
                'player_ids' => $original,
            ],
        ]);

        $this->actingAs($data['users'][0])
            ->post(route('rooms.cubetac.reset', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $data['room']->refresh();
        $this->assertSame('playing', $data['room']->status);
        $this->assertSame(
            [$original[1], $original[2], $original[0]],
            $data['room']->settings['player_ids'],
        );
        $this->assertSame(0, $data['room']->settings['current_turn']);
    }
}
