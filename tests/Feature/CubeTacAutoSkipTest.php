<?php

namespace Tests\Feature;

use App\Http\Controllers\CubeTacGameController;
use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CubeTacAutoSkipTest extends TestCase
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

    public function test_freshly_started_game_stamps_the_turn_clock(): void
    {
        $data = $this->startedGame();

        $this->assertNotNull($data['room']->settings['current_turn_started_at']);
    }

    public function test_enforce_turn_timeout_does_not_advance_before_deadline(): void
    {
        $data = $this->startedGame();
        $room = $data['room'];

        Carbon::setTestNow(Carbon::parse($room->settings['current_turn_started_at'])->addSeconds(10));

        app(CubeTacGameController::class)->enforceTurnTimeout($room->fresh());
        $room->refresh();

        $this->assertSame(0, $room->settings['current_turn']);
    }

    public function test_enforce_turn_timeout_advances_turn_after_deadline(): void
    {
        $data = $this->startedGame();
        $room = $data['room'];

        Carbon::setTestNow(Carbon::parse($room->settings['current_turn_started_at'])->addSeconds(26));

        app(CubeTacGameController::class)->enforceTurnTimeout($room->fresh());
        $room->refresh();

        $this->assertSame(1, $room->settings['current_turn']);
        $this->assertNotNull($room->settings['current_turn_started_at']);
    }

    public function test_timeout_clears_pending_action_and_locks_in_the_mark(): void
    {
        $data = $this->startedGame();
        $room = $data['room'];

        $this->actingAs($data['host'])
            ->post(route('rooms.cubetac.mark', [$data['game']->slug, $room->room_code]), [
                'face' => 0, 'row' => 0, 'col' => 0,
            ])
            ->assertRedirect();
        $room->refresh();

        $this->assertTrue($room->settings['pending_action']);
        $this->assertSame(0, $room->settings['marks'][0]);

        Carbon::setTestNow(Carbon::parse($room->settings['current_turn_started_at'])->addSeconds(26));

        app(CubeTacGameController::class)->enforceTurnTimeout($room->fresh());
        $room->refresh();

        $this->assertFalse($room->settings['pending_action']);
        $this->assertSame(1, $room->settings['current_turn']);
        $this->assertSame(0, $room->settings['marks'][0]);
    }

    public function test_ping_heartbeat_invokes_timeout_enforcement(): void
    {
        $data = $this->startedGame();
        $room = $data['room'];

        Carbon::setTestNow(Carbon::parse($room->settings['current_turn_started_at'])->addSeconds(26));

        $this->actingAs($data['guest'])
            ->post(route('rooms.ping', [$data['game']->slug, $room->room_code]))
            ->assertOk();

        $room->refresh();
        $this->assertSame(1, $room->settings['current_turn']);
    }

    public function test_legacy_game_without_turn_started_stamp_gets_one(): void
    {
        $data = $this->startedGame();
        $room = $data['room'];

        $settings = $room->settings;
        unset($settings['current_turn_started_at']);
        $room->update(['settings' => $settings]);
        $this->assertArrayNotHasKey('current_turn_started_at', $room->fresh()->settings);

        app(CubeTacGameController::class)->enforceTurnTimeout($room->fresh());
        $room->refresh();

        $this->assertNotNull($room->settings['current_turn_started_at']);
        $this->assertSame(0, $room->settings['current_turn']);
    }

    public function test_finished_game_is_not_affected_by_timeout_enforcement(): void
    {
        $data = $this->startedGame();
        $room = $data['room'];

        $settings = $room->settings;
        $settings['winner'] = 0;
        $room->update(['settings' => $settings, 'status' => 'finished']);

        Carbon::setTestNow(Carbon::parse($room->settings['current_turn_started_at'])->addSeconds(60));

        app(CubeTacGameController::class)->enforceTurnTimeout($room->fresh());
        $room->refresh();

        $this->assertSame(0, $room->settings['current_turn']);
    }
}
