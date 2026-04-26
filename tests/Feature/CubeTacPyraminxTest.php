<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use App\Services\PyraminxCube;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CubeTacPyraminxTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{game: Game, room: GameRoom, host: User, guest: User, hostPlayer: GamePlayer, guestPlayer: GamePlayer}
     */
    private function makeRoom(string $variant = 'pyraminx'): array
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $room = GameRoom::factory()
            ->withHost($host)
            ->forGame($game)
            ->create(['variant' => $variant]);

        $hostPlayer = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        $guestPlayer = GamePlayer::factory()->forRoom($room)->forUser($guest)->create();

        return compact('game', 'room', 'host', 'guest', 'hostPlayer', 'guestPlayer');
    }

    public function test_host_can_pick_pyraminx_variant(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $this->actingAs($host)
            ->post(route('rooms.pickVariant', [$game->slug, $room->room_code]), ['variant' => 'pyraminx'])
            ->assertRedirect();

        $this->assertSame('pyraminx', $room->fresh()->variant);
    }

    public function test_starting_a_pyraminx_game_creates_a_36_cell_marks_array(): void
    {
        $data = $this->makeRoom('pyraminx');

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertSame('playing', $room->status);
        $this->assertCount(36, $room->settings['marks']);
        $this->assertSame(60, $room->settings['move_limit']); // 30 * 2 players
        $this->assertNull($room->settings['marks'][0]);
    }

    public function test_pyra_mark_rejects_dead_down_triangle_slots(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Slot 6 is a down-triangle "dead" cell — never markable.
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.pyraMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 6,
            ])
            ->assertSessionHasErrors('slot');
    }

    public function test_pyra_mark_rejects_other_players_turn(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Guest is slot 1; host (slot 0) acts first.
        $this->actingAs($data['guest'])
            ->post(route('rooms.cubetac.pyraMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 1,
            ])
            ->assertSessionHasErrors('error');
    }

    public function test_pyra_mark_then_end_turn_advances_slot(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.pyraMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 1,
            ])
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertTrue($room->settings['pending_action']);
        $this->assertSame(0, $room->settings['current_turn']);
        $this->assertSame(0, $room->settings['marks'][PyraminxCube::indexOf(0, 1)]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.endTurn', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertFalse($room->settings['pending_action']);
        $this->assertSame(1, $room->settings['current_turn']);
    }

    public function test_pyra_rotate_auto_advances_turn_without_confirm(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.pyraRotate', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'direction' => 'cw',
            ])
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertFalse($room->settings['pending_action']);
        $this->assertSame(1, $room->settings['current_turn'], 'rotate should auto-advance the turn');
    }

    public function test_pyra_rotate_rejects_invalid_direction(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.pyraRotate', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'direction' => 'spin',
            ])
            ->assertSessionHasErrors('direction');
    }

    public function test_winning_perimeter_triple_ends_the_game(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Force-set marks so the host's next move completes a perimeter triple
        // (slots 0, 1, 2 on face 0 = corner-edge-corner walking the ring).
        $room = $data['room']->fresh();
        $settings = $room->settings;
        $settings['marks'][PyraminxCube::indexOf(0, 0)] = 0; // host
        $settings['marks'][PyraminxCube::indexOf(0, 1)] = 0; // host
        $room->update(['settings' => $settings]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.pyraMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 2,
            ])
            ->assertRedirect();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('0', $room->winner);
        $this->assertNotEmpty($room->settings['winning_lines']);
        $this->assertSame(0, $room->settings['winning_lines'][0]['player']);
    }

    public function test_rematch_keeps_pyraminx_variant(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Force-finish via winning triple.
        $room = $data['room']->fresh();
        $settings = $room->settings;
        $settings['marks'][PyraminxCube::indexOf(0, 0)] = 0;
        $settings['marks'][PyraminxCube::indexOf(0, 1)] = 0;
        $room->update(['settings' => $settings]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.pyraMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 2,
            ]);

        $room->refresh();
        $this->assertSame('finished', $room->status);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.reset', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $room->refresh();
        $this->assertSame('playing', $room->status);
        $this->assertSame('pyraminx', $room->variant);
        $this->assertCount(36, $room->settings['marks']);
    }

    public function test_cube_route_rejects_pyraminx_room(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'row' => 0,
                'col' => 0,
            ])
            ->assertSessionHasErrors('error');
    }

    public function test_megaminx_route_rejects_pyraminx_room(): void
    {
        $data = $this->makeRoom('pyraminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 1,
            ])
            ->assertSessionHasErrors('error');
    }

    public function test_pyraminx_route_rejects_cube_room(): void
    {
        $data = $this->makeRoom('cube');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.pyraMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 1,
            ])
            ->assertSessionHasErrors('error');
    }
}
