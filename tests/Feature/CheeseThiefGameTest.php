<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheeseThiefGameTest extends TestCase
{
    use RefreshDatabase;

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

        // Verify exactly one thief was assigned
        $thiefCount = $room->connectedPlayers()->where('is_thief', true)->count();
        $this->assertEquals(1, $thiefCount);

        // Verify all players have dice values between 1-6
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

        // Start the game
        $this->actingAs($host)->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Confirm roll as first player
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

        // Start the game
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // All players confirm their rolls
        foreach ($players as $player) {
            $this->actingAs($player->user)->post(route('rooms.confirmRoll', [$room->game->slug, $room->room_code]));
        }

        $room->refresh();
        // Should have advanced past rolling phase (current_hour > 0)
        $this->assertGreaterThanOrEqual(1, $room->current_hour);
    }

    public function test_player_can_peek_when_alone(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Set up a specific scenario: player 0 wakes up at hour 3, alone
        $players[0]->update(['die_value' => 3, 'game_data' => ['confirmed_roll' => true]]);
        $players[1]->update(['die_value' => 1, 'game_data' => ['confirmed_roll' => true]]);
        $players[2]->update(['die_value' => 2, 'game_data' => ['confirmed_roll' => true]]);
        $players[3]->update(['die_value' => 4, 'game_data' => ['confirmed_roll' => true]]);
        $room->update(['current_hour' => 3]);

        // Player 0 should be able to peek
        $response = $this->actingAs($players[0]->user)->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
            'target_player_id' => $players[1]->id,
        ]);

        $response->assertRedirect();

        // Verify peek was recorded
        $players[0]->refresh();
        $peekedPlayers = $players[0]->getPeekedPlayers();
        $this->assertArrayHasKey($players[1]->id, $peekedPlayers);
    }

    public function test_player_cannot_peek_when_not_alone(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Set up: players 0 and 1 both wake up at hour 3
        $players[0]->update(['die_value' => 3, 'game_data' => ['confirmed_roll' => true]]);
        $players[1]->update(['die_value' => 3, 'game_data' => ['confirmed_roll' => true]]);
        $players[2]->update(['die_value' => 2, 'game_data' => ['confirmed_roll' => true]]);
        $players[3]->update(['die_value' => 4, 'game_data' => ['confirmed_roll' => true]]);
        $room->update(['current_hour' => 3]);

        // Player 0 should NOT be able to peek
        $response = $this->actingAs($players[0]->user)->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
            'target_player_id' => $players[2]->id,
        ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_peeking_at_thief_steals_cheese(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Make player 1 the thief
        $players[1]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[1]->id]);

        // Set up: player 0 wakes up alone at hour 3
        $players[0]->update(['die_value' => 3, 'game_data' => ['confirmed_roll' => true]]);
        $players[1]->update(['die_value' => 1, 'game_data' => ['confirmed_roll' => true]]);
        $players[2]->update(['die_value' => 2, 'game_data' => ['confirmed_roll' => true]]);
        $players[3]->update(['die_value' => 4, 'game_data' => ['confirmed_roll' => true]]);
        $room->update(['current_hour' => 3]);

        // Player 0 peeks at the thief (player 1)
        $this->actingAs($players[0]->user)->post(route('rooms.peek', [$room->game->slug, $room->room_code]), [
            'target_player_id' => $players[1]->id,
        ]);

        // Verify cheese was stolen
        $players[0]->refresh();
        $this->assertTrue($players[0]->has_stolen_cheese);
    }

    public function test_player_can_skip_peek(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Set up: player 0 wakes up alone at hour 3
        $players[0]->update(['die_value' => 3, 'game_data' => ['confirmed_roll' => true]]);
        $players[1]->update(['die_value' => 1, 'game_data' => ['confirmed_roll' => true]]);
        $players[2]->update(['die_value' => 2, 'game_data' => ['confirmed_roll' => true]]);
        $players[3]->update(['die_value' => 4, 'game_data' => ['confirmed_roll' => true]]);
        $room->update(['current_hour' => 3]);

        $response = $this->actingAs($players[0]->user)->post(route('rooms.skipPeek', [$room->game->slug, $room->room_code]));

        $response->assertRedirect();
        $players[0]->refresh();
        $this->assertTrue($players[0]->hasCompletedHour(3));
    }

    public function test_thief_can_select_accomplice(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game and make player 0 the thief
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $players[0]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[0]->id, 'current_hour' => 7]);

        // Thief selects accomplice
        $response = $this->actingAs($players[0]->user)->post(route('rooms.selectAccomplice', [$room->game->slug, $room->room_code]), [
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

        // Start the game and make player 0 the thief
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $players[0]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[0]->id, 'current_hour' => 7]);

        // Non-thief (player 1) tries to select accomplice
        $response = $this->actingAs($players[1]->user)->post(route('rooms.selectAccomplice', [$room->game->slug, $room->room_code]), [
            'accomplice_player_id' => $players[2]->id,
        ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_player_can_vote(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game and advance to voting phase
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 8]);

        // Player votes
        $response = $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
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

        // Start the game and advance to voting phase
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 8]);

        // Player tries to vote for themselves
        $response = $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[0]->id,
        ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_game_ends_when_all_vote(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game, set thief and advance to voting phase
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $players[0]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[0]->id, 'current_hour' => 8]);

        // All players vote for player 0 (the thief)
        foreach ($players as $index => $player) {
            $voteFor = $index === 0 ? $players[1]->id : $players[0]->id;
            $this->actingAs($player->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
                'voted_for_player_id' => $voteFor,
            ]);
        }

        $room->refresh();
        $this->assertEquals('finished', $room->status);
        $this->assertEquals(9, $room->current_hour);
        $this->assertNotNull($room->winner);
    }

    public function test_mice_win_when_thief_gets_most_votes(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game, set thief and advance to voting phase
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $players[0]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[0]->id, 'current_hour' => 8]);

        // Players 1, 2, 3 vote for player 0 (thief), player 0 votes for player 1
        $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[1]->id,
        ]);
        $this->actingAs($players[1]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[0]->id,
        ]);
        $this->actingAs($players[2]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[0]->id,
        ]);
        $this->actingAs($players[3]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[0]->id,
        ]);

        $room->refresh();
        $this->assertEquals('mice', $room->winner);
    }

    public function test_thief_wins_when_not_caught(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game, set thief (player 0) and advance to voting phase
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $players[0]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[0]->id, 'current_hour' => 8]);

        // Most players vote for player 1 (not the thief)
        $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[1]->id,
        ]);
        $this->actingAs($players[1]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[2]->id,
        ]);
        $this->actingAs($players[2]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[1]->id,
        ]);
        $this->actingAs($players[3]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[1]->id,
        ]);

        $room->refresh();
        $this->assertEquals('thief', $room->winner);
    }

    public function test_game_state_hides_thief_identity_during_game(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Reset all players' thief status and explicitly set player 1 as thief
        foreach ($players as $player) {
            $player->update(['is_thief' => false]);
        }
        $players[1]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[1]->id]);

        // Refresh player 2 to get updated state
        $players[2]->refresh();

        // View room as non-thief (player 2)
        $response = $this->actingAs($players[2]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $page->component('Rooms/Show')
                ->has('gameState')
                ->where('gameState.is_thief', false);

            // Check that other players' thief status is hidden
            $gameState = $page->toArray()['props']['gameState'];
            foreach ($gameState['players'] as $player) {
                // Only thief can see thief status during game, others should see null
                $this->assertNull($player['is_thief']);
            }
        });
    }

    public function test_game_state_shows_thief_identity_to_thief(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));

        // Reset all players' thief status and explicitly set player 0 as thief
        foreach ($players as $player) {
            $player->update(['is_thief' => false]);
        }
        $players[0]->update(['is_thief' => true]);
        $room->update(['thief_player_id' => $players[0]->id]);

        // Refresh player 0 to get updated state
        $players[0]->refresh();

        // View room as thief
        $response = $this->actingAs($players[0]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) {
            $page->component('Rooms/Show')
                ->has('gameState')
                ->where('gameState.is_thief', true);
        });
    }

    public function test_game_state_reveals_all_roles_after_game_ends(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        // Start the game and finish it
        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $players[0]->update(['is_thief' => true]);
        $players[1]->update(['is_accomplice' => true]);
        $room->update([
            'thief_player_id' => $players[0]->id,
            'accomplice_player_id' => $players[1]->id,
            'current_hour' => 9,
            'status' => 'finished',
            'winner' => 'mice',
        ]);

        // View as any player
        $response = $this->actingAs($players[2]->user)->get(route('rooms.show', [$room->game->slug, $room->room_code]));

        $response->assertInertia(function ($page) use ($players) {
            $page->component('Rooms/Show')
                ->has('gameState')
                ->where('gameState.thief_player_id', $players[0]->id)
                ->where('gameState.accomplice_player_id', $players[1]->id);
        });
    }

    public function test_player_cannot_confirm_roll_after_rolling_phase(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 3]); // Night phase

        $response = $this->actingAs($players[0]->user)->post(route('rooms.confirmRoll', [$room->game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
    }

    public function test_player_cannot_vote_before_voting_phase(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 3]); // Night phase

        $response = $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[1]->id,
        ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_player_cannot_vote_twice(): void
    {
        $data = $this->createGameWithPlayers(4);
        $room = $data['room'];
        $players = $data['players'];

        $this->actingAs($data['host'])->post(route('rooms.start', [$data['game']->slug, $room->room_code]));
        $room->update(['current_hour' => 8]); // Voting phase

        // First vote
        $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[1]->id,
        ]);

        // Try to vote again
        $response = $this->actingAs($players[0]->user)->post(route('rooms.vote', [$room->game->slug, $room->room_code]), [
            'voted_for_player_id' => $players[2]->id,
        ]);

        $response->assertSessionHasErrors('error');
    }
}
