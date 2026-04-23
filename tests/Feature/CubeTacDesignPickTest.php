<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CubeTacDesignPickTest extends TestCase
{
    use RefreshDatabase;

    public function test_host_can_pick_an_available_design(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create([
            'game_data' => ['cubetac_design' => 0],
            'avatar_color' => '#ff4d2e',
        ]);

        $this->actingAs($host)
            ->post(route('rooms.cubetac.pickDesign', [$game->slug, $room->room_code]), [
                'design' => 3,
            ])
            ->assertRedirect();

        $player = GamePlayer::where('user_id', $host->id)->firstOrFail();
        $this->assertSame(3, $player->game_data['cubetac_design']);
        $this->assertSame('#a855f7', $player->avatar_color);
    }

    public function test_duplicate_design_pick_is_rejected(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create([
            'game_data' => ['cubetac_design' => 0],
        ]);
        $guestPlayer = GamePlayer::factory()->forRoom($room)->forUser($guest)->create([
            'game_data' => ['cubetac_design' => 2],
        ]);

        $this->actingAs($host)
            ->post(route('rooms.cubetac.pickDesign', [$game->slug, $room->room_code]), [
                'design' => 2,
            ])
            ->assertStatus(422);

        $this->assertSame(0, GamePlayer::where('user_id', $host->id)->value('game_data')['cubetac_design']);
        $this->assertSame(2, $guestPlayer->fresh()->game_data['cubetac_design']);
    }

    public function test_design_pick_is_rejected_once_game_is_playing(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create([
            'game_data' => ['cubetac_design' => 0],
        ]);
        GamePlayer::factory()->forRoom($room)->forUser($guest)->create([
            'game_data' => ['cubetac_design' => 1],
        ]);

        $this->actingAs($host)
            ->post(route('rooms.cubetac.start', [$game->slug, $room->room_code]))
            ->assertRedirect();

        $this->actingAs($host)
            ->post(route('rooms.cubetac.pickDesign', [$game->slug, $room->room_code]), [
                'design' => 4,
            ])
            ->assertSessionHasErrors('error');

        $this->assertSame(0, GamePlayer::where('user_id', $host->id)->value('game_data')['cubetac_design']);
    }

    public function test_join_as_player_auto_assigns_first_available_design(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();

        // Simulate show() auto-join: host hits the room page unauthenticated-as-player,
        // controller adds them via joinAsPlayer().
        $this->actingAs($host)
            ->get(route('rooms.show', [$game->slug, $room->room_code]))
            ->assertOk();

        $hostPlayer = GamePlayer::where('user_id', $host->id)->firstOrFail();
        $this->assertSame(0, $hostPlayer->game_data['cubetac_design']);
        $this->assertSame('#ff4d2e', $hostPlayer->avatar_color);

        // A second user joining picks design 1 (first available after 0).
        $guest = User::factory()->create();
        $this->actingAs($guest)
            ->get(route('rooms.show', [$game->slug, $room->room_code]))
            ->assertOk();

        $guestPlayer = GamePlayer::where('user_id', $guest->id)->firstOrFail();
        $this->assertSame(1, $guestPlayer->game_data['cubetac_design']);
        $this->assertSame('#3a90ff', $guestPlayer->avatar_color);
    }

    public function test_build_game_state_returns_designs_indexed_by_slot(): void
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create([
            'game_data' => ['cubetac_design' => 4],
            'avatar_color' => '#f59e0b',
        ]);
        GamePlayer::factory()->forRoom($room)->forUser($guest)->create([
            'game_data' => ['cubetac_design' => 2],
            'avatar_color' => '#16a34a',
        ]);

        $this->actingAs($host)
            ->post(route('rooms.cubetac.start', [$game->slug, $room->room_code]))
            ->assertRedirect();

        $response = $this->actingAs($host)
            ->get(route('rooms.show', [$game->slug, $room->room_code]))
            ->assertOk();

        $gameState = $response->viewData('page')['props']['gameState'];
        $this->assertSame([4, 2], $gameState['designs']);
        $this->assertSame(4, $gameState['players'][0]['design']);
        $this->assertSame(2, $gameState['players'][1]['design']);
    }
}
