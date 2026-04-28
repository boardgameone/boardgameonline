<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CubeTacReconnectTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{game: Game, room: GameRoom, host: User, guest: User, hostPlayer: GamePlayer, guestPlayer: GamePlayer}
     */
    private function startedGame(): array
    {
        $game = Game::factory()->cubeTac()->create();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        $hostPlayer = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        $guestPlayer = GamePlayer::factory()->forRoom($room)->forUser($guest)->create();

        $this->actingAs($host)
            ->post(route('rooms.cubetac.start', [$game->slug, $room->room_code]))
            ->assertRedirect();

        $room->refresh();

        return compact('game', 'room', 'host', 'guest', 'hostPlayer', 'guestPlayer');
    }

    public function test_ping_updates_last_seen_at_for_current_player(): void
    {
        $data = $this->startedGame();

        $this->assertNull($data['hostPlayer']->fresh()->last_seen_at);

        $this->actingAs($data['host'])
            ->post(route('rooms.ping', [$data['game']->slug, $data['room']->room_code]))
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertNotNull($data['hostPlayer']->fresh()->last_seen_at);
    }

    public function test_ping_marks_player_as_connected(): void
    {
        $data = $this->startedGame();
        $data['hostPlayer']->update(['is_connected' => false]);

        $this->actingAs($data['host'])
            ->post(route('rooms.ping', [$data['game']->slug, $data['room']->room_code]))
            ->assertOk();

        $this->assertTrue($data['hostPlayer']->fresh()->is_connected);
    }

    public function test_ping_rejects_non_player(): void
    {
        $data = $this->startedGame();
        $stranger = User::factory()->create();

        $this->actingAs($stranger)
            ->post(route('rooms.ping', [$data['game']->slug, $data['room']->room_code]))
            ->assertStatus(403);
    }

    public function test_build_game_state_marks_player_stale_after_threshold(): void
    {
        $data = $this->startedGame();

        // Ping recently — player is fresh.
        $this->actingAs($data['guest'])
            ->post(route('rooms.ping', [$data['game']->slug, $data['room']->room_code]))
            ->assertOk();

        $response = $this->actingAs($data['host'])
            ->get(route('rooms.show', [$data['game']->slug, $data['room']->room_code]));

        $response->assertOk();
        $players = $response->viewData('page')['props']['gameState']['players'];
        $guestPayload = collect($players)->firstWhere('id', $data['guestPlayer']->id);
        $this->assertFalse($guestPayload['is_stale']);

        // Push the guest's last_seen_at past the 15s threshold.
        $data['guestPlayer']->update(['last_seen_at' => now()->subSeconds(30)]);

        $response = $this->actingAs($data['host'])
            ->get(route('rooms.show', [$data['game']->slug, $data['room']->room_code]));
        $players = $response->viewData('page')['props']['gameState']['players'];
        $guestPayload = collect($players)->firstWhere('id', $data['guestPlayer']->id);
        $this->assertTrue($guestPayload['is_stale']);
    }

    public function test_build_game_state_includes_timer_fields(): void
    {
        $data = $this->startedGame();

        $response = $this->actingAs($data['host'])
            ->get(route('rooms.show', [$data['game']->slug, $data['room']->room_code]));

        $response->assertOk();
        $state = $response->viewData('page')['props']['gameState'];

        $this->assertArrayHasKey('current_turn_started_at', $state);
        $this->assertArrayHasKey('turn_seconds', $state);
        $this->assertArrayHasKey('server_time', $state);
        $this->assertSame(20, $state['turn_seconds']);
    }

    public function test_player_with_null_last_seen_is_not_marked_stale(): void
    {
        $data = $this->startedGame();
        // Fresh players join with null last_seen_at — they shouldn't appear stale
        // until they've had at least one heartbeat.
        $this->assertNull($data['guestPlayer']->fresh()->last_seen_at);

        $response = $this->actingAs($data['host'])
            ->get(route('rooms.show', [$data['game']->slug, $data['room']->room_code]));

        $players = $response->viewData('page')['props']['gameState']['players'];
        $guestPayload = collect($players)->firstWhere('id', $data['guestPlayer']->id);
        $this->assertFalse($guestPayload['is_stale']);
    }
}
