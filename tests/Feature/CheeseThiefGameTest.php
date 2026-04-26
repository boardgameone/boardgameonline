<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CheeseThiefGameTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Throttle middleware uses the cache; clear it so per-IP counters
        // don't bleed across tests within the same PHP process.
        Cache::flush();
    }

    /**
     * @return array{game: Game, room: GameRoom, players: array<int, GamePlayer>, host: User}
     */
    private function createGameWithPlayers(int $playerCount = 4): array
    {
        $game = Game::factory()->create(['min_players' => 4, 'max_players' => 8]);
        $host = User::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();

        $players = [];
        $players[] = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        for ($i = 1; $i < $playerCount; $i++) {
            $user = User::factory()->create();
            $players[] = GamePlayer::factory()->forRoom($room)->forUser($user)->create();
        }

        return ['game' => $game, 'room' => $room, 'players' => $players, 'host' => $host];
    }

    /**
     * Force `$thief` to be the only thief in the room. Uses raw queries to
     * bypass Eloquent's "skip update when not dirty" optimization, which would
     * otherwise leave the random thief assigned by start() untouched.
     */
    private function rigThief(GameRoom $room, GamePlayer $thief): void
    {
        $room->players()->update(['is_thief' => false]);
        $room->players()->whereKey($thief->id)->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $thief->id]);
        foreach ($room->players as $p) {
            $p->refresh();
        }
        $thief->refresh();
    }

    public function test_starting_game_assigns_thief_and_rolls_dice(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $host = $data['host'];

        $this->actingAs($host)->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $room->refresh();
        $this->assertEquals('playing', $room->status);
        $this->assertEquals(0, $room->current_hour);
        $this->assertNotNull($room->thief_player_id);
        $this->assertNull($room->cheese_stolen_at_hour);

        $thiefCount = $room->connectedPlayers()->where('is_thief', true)->count();
        $this->assertEquals(1, $thiefCount);

        foreach ($room->connectedPlayers as $player) {
            $this->assertNotNull($player->die_value);
            $this->assertGreaterThanOrEqual(1, $player->die_value);
            $this->assertLessThanOrEqual(6, $player->die_value);
        }
    }

    public function test_player_can_confirm_roll(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $host = $data['host'];
        $players = $data['players'];

        $this->actingAs($host)->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $response = $this->actingAs($host)->post(route('rooms.confirmRoll', [$room->game->slug, $room->room_code]));

        $response->assertRedirect();
        $players[0]->refresh();
        $this->assertTrue($players[0]->hasConfirmedRoll());
    }

    public function test_game_advances_to_night_when_all_confirm(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        foreach ($players as $player) {
            $this->actingAs($player->user)->post(route('rooms.confirmRoll', [$room->game->slug, $room->room_code]));
        }

        $room->refresh();
        $this->assertGreaterThanOrEqual(1, $room->current_hour);
    }

    // --- Steal cheese mechanic ---

    public function test_thief_can_steal_cheese_during_their_hour(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[0]);
        $players[0]->update(['die_value' => 3]);
        $room->update([
            'current_hour' => 3,
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => null,
        ]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.stealCheese', [$room->game->slug, $room->room_code]));

        $response->assertRedirect();
        $room->refresh();
        $this->assertEquals(3, $room->cheese_stolen_at_hour);
    }

    public function test_non_thief_cannot_steal_cheese(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[0]);
        $players[0]->update(['die_value' => 3]);
        $players[1]->update(['die_value' => 3]); // also awake at hour 3
        $room->update([
            'current_hour' => 3,
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => null,
        ]);

        $response = $this->actingAs($players[1]->user)
            ->post(route('rooms.stealCheese', [$room->game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
        $room->refresh();
        $this->assertNull($room->cheese_stolen_at_hour);
    }

    public function test_thief_cannot_steal_outside_their_hour(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[0]);
        $players[0]->update(['die_value' => 4]);
        $room->update([
            'current_hour' => 3,
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => null,
        ]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.stealCheese', [$room->game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
        $room->refresh();
        $this->assertNull($room->cheese_stolen_at_hour);
    }

    public function test_thief_cannot_steal_twice(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[0]);
        $players[0]->update(['die_value' => 3]);
        $room->update([
            'current_hour' => 3,
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => 3,
        ]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.stealCheese', [$room->game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
    }

    public function test_cheese_auto_steals_when_thief_hour_expires_via_tick(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[1]);
        foreach ($players as $i => $player) {
            $player->update([
                'die_value' => $i + 1, // 1..4
                'game_data' => ['confirmed_roll' => true],
            ]);
        }
        $room->update([
            'current_hour' => 2, // thief's wake hour
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => null,
        ]);

        Carbon::setTestNow(now()->addSeconds(13)); // past 12s timer

        // settleNight runs as part of show()
        $this->actingAs($players[0]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $room->refresh();
        $this->assertEquals(2, $room->cheese_stolen_at_hour);
        $this->assertGreaterThan(2, $room->current_hour);

        Carbon::setTestNow();
    }

    // --- Equal-duration hours / narrator pacing ---

    public function test_every_hour_uses_the_same_timer_duration(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Empty hour: nobody awake at hour 1.
        foreach ($players as $i => $player) {
            $player->update(['die_value' => $i + 3]); // 3..6
        }
        $room->update(['current_hour' => 1, 'hour_started_at' => now()]);
        $room->refresh();
        $emptyDuration = $room->getHourTimerDuration();

        // Solo hour: only player 0 awake at hour 3.
        $room->update(['current_hour' => 3]);
        $room->refresh();
        $soloDuration = $room->getHourTimerDuration();

        // Multi-player hour: rig two players to hour 5.
        $players[0]->update(['die_value' => 5]);
        $players[1]->update(['die_value' => 5]);
        $room->update(['current_hour' => 5]);
        $room->refresh();
        $multiDuration = $room->getHourTimerDuration();

        $this->assertEquals($emptyDuration, $soloDuration);
        $this->assertEquals($soloDuration, $multiDuration);
    }

    public function test_hour_timer_does_not_expire_before_full_duration(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        Carbon::setTestNow(now());
        $room->update(['current_hour' => 3, 'hour_started_at' => now()]);

        // Halfway through the timer.
        Carbon::setTestNow(now()->addSeconds((int) ($room->getHourTimerDuration() / 2)));
        $room->refresh();
        $this->assertFalse($room->isHourTimerExpired());

        // Past the timer.
        Carbon::setTestNow(now()->addSeconds($room->getHourTimerDuration() + 1));
        $room->refresh();
        $this->assertTrue($room->isHourTimerExpired());

        Carbon::setTestNow();
    }

    public function test_show_settles_expired_night_hours(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Nobody awake at hour 1 or 2.
        $players[0]->update(['die_value' => 3, 'game_data' => ['confirmed_roll' => true]]);
        $players[1]->update(['die_value' => 4, 'game_data' => ['confirmed_roll' => true]]);
        $players[2]->update(['die_value' => 5, 'game_data' => ['confirmed_roll' => true]]);
        $players[3]->update(['die_value' => 6, 'game_data' => ['confirmed_roll' => true]]);

        Carbon::setTestNow(now());
        $room->update(['current_hour' => 1, 'hour_started_at' => now()]);

        // Past one timer cycle: should advance to hour 2 but not skip more (timer freshly reset).
        Carbon::setTestNow(now()->addSeconds(13));
        $this->actingAs($players[0]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $room->refresh();
        $this->assertEquals(2, $room->current_hour);

        Carbon::setTestNow();
    }

    public function test_show_settles_through_multiple_expired_hours(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $players[0]->update(['die_value' => 3, 'game_data' => ['confirmed_roll' => true]]);
        $players[1]->update(['die_value' => 4, 'game_data' => ['confirmed_roll' => true]]);
        $players[2]->update(['die_value' => 5, 'game_data' => ['confirmed_roll' => true]]);
        $players[3]->update(['die_value' => 6, 'game_data' => ['confirmed_roll' => true]]);

        Carbon::setTestNow(now());
        $room->update(['current_hour' => 1, 'hour_started_at' => now()]);

        // Past three timer cycles (idle tab).
        Carbon::setTestNow(now()->addSeconds(13 * 3 + 1));
        $this->actingAs($players[0]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $room->refresh();
        $this->assertGreaterThanOrEqual(4, $room->current_hour);

        Carbon::setTestNow();
    }

    public function test_show_advances_to_accomplice_phase_after_hour_six_expires(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[0]);
        foreach ($players as $player) {
            $player->update([
                'die_value' => 6,
                'game_data' => ['confirmed_roll' => true],
            ]);
        }
        $room->update([
            'current_hour' => 6,
            'hour_started_at' => now(),
        ]);

        Carbon::setTestNow(now()->addSeconds(13));
        $this->actingAs($players[0]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $room->refresh();
        $this->assertEquals(7, $room->current_hour);
        // Auto-steal must have fired during settle.
        $this->assertEquals(6, $room->cheese_stolen_at_hour);

        Carbon::setTestNow();
    }

    // --- Accomplice + voting (existing flows preserved) ---

    public function test_thief_can_select_accomplice(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);
        $room->update(['current_hour' => 7]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.selectAccomplice', [$room->game->slug, $room->room_code]), [
                'accomplice_player_id' => $players[1]->id,
            ]);

        $response->assertRedirect();
        $room->refresh();
        $players[1]->refresh();
        $this->assertEquals($players[1]->id, $room->accomplice_player_id);
        $this->assertTrue($players[1]->is_accomplice);
    }

    public function test_non_thief_cannot_select_accomplice(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);
        $room->update(['current_hour' => 7]);

        $response = $this->actingAs($players[1]->user)
            ->post(route('rooms.selectAccomplice', [$room->game->slug, $room->room_code]), [
                'accomplice_player_id' => $players[2]->id,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_player_can_vote(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 8]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
                'voted_for_player_id' => $players[1]->id,
            ]);

        $response->assertRedirect();
        $players[0]->refresh();
        $this->assertTrue($players[0]->hasVoted());
    }

    public function test_player_cannot_vote_for_self(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 8]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
                'voted_for_player_id' => $players[0]->id,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_player_cannot_vote_twice(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 8]);

        $this->actingAs($players[0]->user)
            ->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
                'voted_for_player_id' => $players[1]->id,
            ]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
                'voted_for_player_id' => $players[2]->id,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_mice_win_when_thief_unanimously_caught(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);
        $room->update(['current_hour' => 8]);

        $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[1]->id]);
        $this->actingAs($players[1]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[0]->id]);
        $this->actingAs($players[2]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[0]->id]);
        $this->actingAs($players[3]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[0]->id]);

        $room->refresh();
        $this->assertEquals('mice', $room->winner);
    }

    public function test_thief_wins_when_not_caught(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);
        $room->update(['current_hour' => 8]);

        $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[1]->id]);
        $this->actingAs($players[1]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[2]->id]);
        $this->actingAs($players[2]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[1]->id]);
        $this->actingAs($players[3]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), ['voted_for_player_id' => $players[1]->id]);

        $room->refresh();
        $this->assertEquals('thief', $room->winner);
    }

    // --- Visibility + game state ---

    public function test_game_state_hides_thief_identity_during_game(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[1]);

        $players[2]->refresh()->load('user');

        $response = $this->actingAs($players[2]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $page->component('Rooms/Show')
                ->has('gameState')
                ->where('gameState.is_thief', false);

            $gameState = $page->toArray()['props']['gameState'];
            foreach ($gameState['players'] as $player) {
                $this->assertNull($player['is_thief']);
            }
        });
    }

    public function test_game_state_shows_thief_identity_to_thief(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);

        $players[0]->refresh();
        $response = $this->actingAs($players[0]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $page->component('Rooms/Show')
                ->has('gameState')
                ->where('gameState.is_thief', true);
        });
    }

    public function test_game_state_hides_other_players_die_values(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $players[0]->update(['die_value' => 1]);
        $players[1]->update(['die_value' => 2]);
        $players[2]->update(['die_value' => 3]);
        $players[3]->update(['die_value' => 4]);

        $players[0]->refresh()->load('user');
        $response = $this->actingAs($players[0]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) use ($players) {
            $gameState = $page->toArray()['props']['gameState'];
            foreach ($gameState['players'] as $p) {
                if ($p['id'] === $players[0]->id) {
                    $this->assertEquals(1, $p['die_value']);
                } else {
                    $this->assertNull($p['die_value']);
                }
            }
        });
    }

    public function test_game_state_reveals_all_roles_after_game_ends(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);
        $players[1]->update(['is_accomplice' => true]);
        $room->update([
            'accomplice_player_id' => $players[1]->id,
            'current_hour' => 9,
            'status' => 'finished',
            'winner' => 'mice',
            'cheese_stolen_at_hour' => 4,
        ]);

        $response = $this->actingAs($players[2]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) use ($players) {
            $page->component('Rooms/Show')
                ->has('gameState')
                ->where('gameState.thief_player_id', $players[0]->id)
                ->where('gameState.accomplice_player_id', $players[1]->id)
                ->where('gameState.cheese_stolen_at_hour', 4);
        });
    }

    public function test_cheese_visibility_present_during_own_hour_before_steal(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[3]);
        foreach ($players as $i => $player) {
            $player->update(['die_value' => $i + 1]); // 1..4, thief wakes at 4
        }
        $room->update([
            'current_hour' => 2,
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => null,
        ]);

        $response = $this->actingAs($players[1]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $page->where('gameState.cheese_visible_to_self', 'present');
        });
    }

    public function test_cheese_visibility_gone_after_thief_hour(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // player 0 wakes at 4 (after thief). Thief is player 3 with die=2.
        $this->rigThief($room, $players[3]);
        $players[0]->update(['die_value' => 4]);
        $players[1]->update(['die_value' => 1]);
        $players[2]->update(['die_value' => 5]);
        $players[3]->update(['die_value' => 2]);
        $room->update([
            'current_hour' => 4,
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => 2,
        ]);

        $response = $this->actingAs($players[0]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $page->where('gameState.cheese_visible_to_self', 'gone');
        });
    }

    public function test_cheese_visibility_hidden_when_not_awake(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[1]);
        $players[0]->update(['die_value' => 5]);
        $players[1]->update(['die_value' => 1]);
        $players[2]->update(['die_value' => 2]);
        $players[3]->update(['die_value' => 3]);
        $room->update([
            'current_hour' => 2, // player 0 not awake, hour 2 is player 2's
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => null,
        ]);

        $response = $this->actingAs($players[0]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $page->where('gameState.cheese_visible_to_self', 'hidden');
        });
    }

    public function test_can_steal_cheese_flag_only_for_thief_during_their_hour(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $this->rigThief($room, $players[0]);
        foreach ($players as $i => $player) {
            $player->update(['die_value' => $i + 1]);
        }
        $room->update([
            'current_hour' => 1,
            'hour_started_at' => now(),
            'cheese_stolen_at_hour' => null,
        ]);

        $thiefResponse = $this->actingAs($players[0]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $thiefResponse->assertInertia(function ($page) {
            $page->where('gameState.can_steal_cheese', true);
        });

        $miceResponse = $this->actingAs($players[1]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $miceResponse->assertInertia(function ($page) {
            $page->where('gameState.can_steal_cheese', false);
        });
    }

    public function test_player_cannot_confirm_roll_after_rolling_phase(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 3]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.confirmRoll', [$room->game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
    }

    public function test_timer_does_not_apply_to_non_night_phases(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        $room->update(['current_hour' => 0, 'hour_started_at' => now()]);
        $this->assertFalse($room->isHourTimerExpired());

        $room->update(['current_hour' => 7, 'hour_started_at' => null]);
        $this->assertFalse($room->isHourTimerExpired());

        $room->update(['current_hour' => 8, 'hour_started_at' => null]);
        $this->assertFalse($room->isHourTimerExpired());
    }

    // --- Peek when alone ---

    public function test_peeker_alone_sees_target_die_value(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[2]);
        $players[0]->update(['die_value' => 3]);
        $players[1]->update(['die_value' => 6]);
        $players[2]->update(['die_value' => 4]);
        $players[3]->update(['die_value' => 5]);
        $room->update(['current_hour' => 3, 'hour_started_at' => now(), 'cheese_stolen_at_hour' => null]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
                'target_player_id' => $players[1]->id,
            ]);

        $response->assertRedirect();
        $players[0]->refresh();
        $this->assertEquals([$players[1]->id => 6], $players[0]->getPeekedPlayers());
        $this->assertTrue($players[0]->hasPeekedAtHour(3));
    }

    public function test_peek_blocked_when_two_mice_share_the_hour(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[2]);
        $players[0]->update(['die_value' => 3]);
        $players[1]->update(['die_value' => 3]); // shared hour
        $players[2]->update(['die_value' => 4]);
        $players[3]->update(['die_value' => 5]);
        $room->update(['current_hour' => 3, 'hour_started_at' => now()]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
                'target_player_id' => $players[2]->id,
            ]);

        $response->assertSessionHasErrors('error');
        $players[0]->refresh();
        $this->assertEmpty($players[0]->getPeekedPlayers());
    }

    public function test_peek_blocked_outside_own_wake_hour(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[2]);
        $players[0]->update(['die_value' => 5]);
        $players[1]->update(['die_value' => 6]);
        $room->update(['current_hour' => 3, 'hour_started_at' => now()]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
                'target_player_id' => $players[1]->id,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_only_one_peek_per_hour(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[2]);
        $players[0]->update(['die_value' => 3]);
        $players[1]->update(['die_value' => 6]);
        $players[2]->update(['die_value' => 4]);
        $players[3]->update(['die_value' => 5]);
        $room->update(['current_hour' => 3, 'hour_started_at' => now()]);

        $this->actingAs($players[0]->user)
            ->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
                'target_player_id' => $players[1]->id,
            ]);

        $response = $this->actingAs($players[0]->user)
            ->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
                'target_player_id' => $players[3]->id,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_can_peek_flag_only_for_alone_mouse(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[2]);
        $players[0]->update(['die_value' => 3]);
        $players[1]->update(['die_value' => 5]);
        $players[2]->update(['die_value' => 4]);
        $players[3]->update(['die_value' => 6]);
        $room->update(['current_hour' => 3, 'hour_started_at' => now()]);

        $aloneResponse = $this->actingAs($players[0]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));
        $aloneResponse->assertInertia(fn ($page) => $page->where('gameState.can_peek', true));

        $sleepingResponse = $this->actingAs($players[1]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));
        $sleepingResponse->assertInertia(fn ($page) => $page->where('gameState.can_peek', false));
    }

    public function test_peeked_die_value_visible_in_game_state(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[2]);
        $players[0]->update(['die_value' => 3]);
        $players[1]->update(['die_value' => 6]);
        $players[2]->update(['die_value' => 4]);
        $players[3]->update(['die_value' => 5]);
        $room->update(['current_hour' => 3, 'hour_started_at' => now()]);

        $this->actingAs($players[0]->user)
            ->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
                'target_player_id' => $players[1]->id,
            ]);

        $response = $this->actingAs($players[0]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) use ($players) {
            $gameState = $page->toArray()['props']['gameState'];
            $peeked = collect($gameState['players'])->firstWhere('id', $players[1]->id);
            $other = collect($gameState['players'])->firstWhere('id', $players[3]->id);
            $this->assertEquals(6, $peeked['die_value']);
            $this->assertNull($other['die_value']);
        });
    }

    // --- Accomplice sees thief ---

    public function test_accomplice_sees_thief_identity_after_being_picked(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);
        $players[1]->update(['is_accomplice' => true]);
        $room->update([
            'accomplice_player_id' => $players[1]->id,
            'current_hour' => 8, // voting phase
        ]);

        $response = $this->actingAs($players[1]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) use ($players) {
            $gameState = $page->toArray()['props']['gameState'];
            $this->assertEquals($players[0]->id, $gameState['thief_player_id']);
            $thiefRow = collect($gameState['players'])->firstWhere('id', $players[0]->id);
            $this->assertTrue($thiefRow['is_thief']);
        });
    }

    public function test_innocent_mouse_does_not_see_thief_identity(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $this->rigThief($room, $players[0]);
        $players[1]->update(['is_accomplice' => true]);
        $room->update([
            'accomplice_player_id' => $players[1]->id,
            'current_hour' => 8,
        ]);

        // Player 2 is an innocent mouse — should NOT see thief identity.
        $response = $this->actingAs($players[2]->user)
            ->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $gameState = $page->toArray()['props']['gameState'];
            $this->assertNull($gameState['thief_player_id']);
            foreach ($gameState['players'] as $p) {
                $this->assertNull($p['is_thief']);
            }
        });
    }
}
