<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use App\Services\MegaminxCube;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CubeTacMegaminxTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{game: Game, room: GameRoom, host: User, guest: User, hostPlayer: GamePlayer, guestPlayer: GamePlayer}
     */
    private function makeRoom(string $variant = 'megaminx'): array
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

    public function test_host_can_change_variant_in_waiting(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $this->actingAs($host)
            ->post(route('rooms.pickVariant', [$game->slug, $room->room_code]), ['variant' => 'megaminx'])
            ->assertRedirect();

        $this->assertSame('megaminx', $room->fresh()->variant);
    }

    public function test_non_host_cannot_change_variant(): void
    {
        $data = $this->makeRoom('cube');

        $this->actingAs($data['guest'])
            ->post(route('rooms.pickVariant', [$data['game']->slug, $data['room']->room_code]), ['variant' => 'megaminx'])
            ->assertForbidden();

        $this->assertSame('cube', $data['room']->fresh()->variant);
    }

    public function test_variant_cannot_change_after_start(): void
    {
        $data = $this->makeRoom('megaminx');

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $this->actingAs($data['host'])
            ->post(route('rooms.pickVariant', [$data['game']->slug, $data['room']->room_code]), ['variant' => 'cube'])
            ->assertSessionHasErrors('error');

        $this->assertSame('megaminx', $data['room']->fresh()->variant);
    }

    public function test_starting_a_megaminx_game_creates_a_132_cell_marks_array(): void
    {
        $data = $this->makeRoom('megaminx');

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertSame('playing', $room->status);
        $this->assertCount(132, $room->settings['marks']);
        $this->assertSame(60, $room->settings['move_limit']); // 30 * 2 players
        $this->assertNull($room->settings['marks'][0]);
    }

    public function test_mega_mark_rejects_center_slot(): void
    {
        $data = $this->makeRoom('megaminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 0,
            ])
            ->assertSessionHasErrors('slot');
    }

    public function test_mega_mark_rejects_other_players_turn(): void
    {
        $data = $this->makeRoom('megaminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Guest is slot 1; host (slot 0) acts first.
        $this->actingAs($data['guest'])
            ->post(route('rooms.cubetac.megaMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 1,
            ])
            ->assertSessionHasErrors('error');
    }

    public function test_mega_mark_then_end_turn_advances_slot(): void
    {
        $data = $this->makeRoom('megaminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 1,
            ])
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertTrue($room->settings['pending_action']);
        $this->assertSame(0, $room->settings['current_turn']);
        $this->assertSame(0, $room->settings['marks'][MegaminxCube::indexOf(0, 1)]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.endTurn', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertFalse($room->settings['pending_action']);
        $this->assertSame(1, $room->settings['current_turn']);
    }

    public function test_mega_rotate_auto_advances_turn_without_confirm(): void
    {
        $data = $this->makeRoom('megaminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaRotate', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'direction' => 'cw',
            ])
            ->assertRedirect();

        $room = $data['room']->fresh();
        $this->assertFalse($room->settings['pending_action']);
        $this->assertSame(1, $room->settings['current_turn'], 'rotate should auto-advance the turn');
    }

    public function test_mega_rotate_rejects_invalid_direction(): void
    {
        $data = $this->makeRoom('megaminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaRotate', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'direction' => 'spin',
            ])
            ->assertSessionHasErrors('direction');
    }

    public function test_winning_perimeter_triple_ends_the_game(): void
    {
        $data = $this->makeRoom('megaminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Force-set marks so the host's next move completes a perimeter triple.
        $room = $data['room']->fresh();
        $settings = $room->settings;
        $settings['marks'][MegaminxCube::indexOf(0, 1)] = 0; // host
        $settings['marks'][MegaminxCube::indexOf(0, 2)] = 0; // host
        $room->update(['settings' => $settings]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 3,
            ])
            ->assertRedirect();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('0', $room->winner);
        $this->assertNotEmpty($room->settings['winning_lines']);
        $this->assertSame(0, $room->settings['winning_lines'][0]['player']);
    }

    public function test_rematch_keeps_megaminx_variant(): void
    {
        $data = $this->makeRoom('megaminx');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        // Force-finish via winning triple.
        $room = $data['room']->fresh();
        $settings = $room->settings;
        $settings['marks'][MegaminxCube::indexOf(0, 1)] = 0;
        $settings['marks'][MegaminxCube::indexOf(0, 2)] = 0;
        $room->update(['settings' => $settings]);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 3,
            ]);

        $room->refresh();
        $this->assertSame('finished', $room->status);

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.reset', [$data['game']->slug, $data['room']->room_code]))
            ->assertRedirect();

        $room->refresh();
        $this->assertSame('playing', $room->status);
        $this->assertSame('megaminx', $room->variant);
        $this->assertCount(132, $room->settings['marks']);
    }

    public function test_cube_route_rejects_megaminx_room(): void
    {
        $data = $this->makeRoom('megaminx');
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

    public function test_megaminx_route_rejects_cube_room(): void
    {
        $data = $this->makeRoom('cube');
        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.start', [$data['game']->slug, $data['room']->room_code]));

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.megaMark', [$data['game']->slug, $data['room']->room_code]), [
                'face' => 0,
                'slot' => 1,
            ])
            ->assertSessionHasErrors('error');
    }
}
