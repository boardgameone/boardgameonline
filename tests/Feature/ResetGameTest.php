<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameAction;
use App\Models\GameCardReveal;
use App\Models\GamePeek;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameVote;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ResetGameTest extends TestCase
{
    use RefreshDatabase;

    public function test_host_can_reset_finished_cheese_thief_game(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'cheese-thief', 'min_players' => 2, 'max_players' => 10]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create([
            'thief_player_id' => 1,
            'accomplice_player_id' => 2,
            'winner' => 'mice',
            'current_hour' => 6,
        ]);
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->create();

        $response = $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $response->assertRedirect(route('rooms.show', [$game->slug, $room->room_code]));
        $room->refresh();
        $this->assertEquals('waiting', $room->status);
        $this->assertNull($room->thief_player_id);
        $this->assertNull($room->accomplice_player_id);
        $this->assertNull($room->winner);
        $this->assertEquals(0, $room->current_hour);
        $this->assertNull($room->started_at);
        $this->assertNull($room->ended_at);
    }

    public function test_host_can_reset_finished_trio_game(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'trio', 'min_players' => 3, 'max_players' => 6]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create([
            'winner' => 'team',
            'settings' => ['difficulty' => 'medium'],
        ]);
        $hostPlayer = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->create();
        GamePlayer::factory()->forRoom($room)->create();

        $response = $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $response->assertRedirect(route('rooms.show', [$game->slug, $room->room_code]));
        $room->refresh();
        $this->assertEquals('waiting', $room->status);
        $this->assertNull($room->winner);
        $this->assertNull($room->settings);
        $this->assertNull($room->started_at);
        $this->assertNull($room->ended_at);
    }

    public function test_non_host_cannot_reset_game(): void
    {
        $host = User::factory()->create();
        $player = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->forUser($player)->create();

        $response = $this->actingAs($player)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $response->assertStatus(403);
    }

    public function test_cannot_reset_waiting_game(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create(['status' => 'waiting']);
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $response = $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
        $room->refresh();
        $this->assertEquals('waiting', $room->status);
    }

    public function test_cannot_reset_playing_game(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->playing()->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->create();

        $response = $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
        $room->refresh();
        $this->assertEquals('playing', $room->status);
    }

    public function test_reset_clears_all_game_data(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create([
            'thief_player_id' => 1,
            'accomplice_player_id' => 2,
            'winner' => 'thief',
            'current_hour' => 6,
            'settings' => ['difficulty' => 'hard'],
        ]);
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->create();

        $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $room->refresh();
        $this->assertNull($room->thief_player_id);
        $this->assertNull($room->accomplice_player_id);
        $this->assertNull($room->winner);
        $this->assertEquals(0, $room->current_hour);
        $this->assertNull($room->settings);
        $this->assertNull($room->started_at);
        $this->assertNull($room->ended_at);
    }

    public function test_reset_preserves_players(): void
    {
        $host = User::factory()->create();
        $player1 = User::factory()->create();
        $player2 = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2, 'max_players' => 10]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->forUser($player1)->create();
        GamePlayer::factory()->forRoom($room)->forUser($player2)->create();

        $playerCountBefore = $room->players()->count();

        $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $room->refresh();
        $this->assertEquals($playerCountBefore, $room->players()->count());
        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'user_id' => $host->id,
            'is_host' => true,
            'is_connected' => true,
        ]);
        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'user_id' => $player1->id,
            'is_connected' => true,
        ]);
    }

    public function test_reset_clears_peeks_votes_actions(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create();
        $hostPlayer = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        $otherPlayer = GamePlayer::factory()->forRoom($room)->create();

        // Create game-specific data
        GamePeek::create([
            'game_room_id' => $room->id,
            'peeker_id' => $hostPlayer->id,
            'peeked_at_id' => $otherPlayer->id,
            'hour' => 3,
            'saw_thief' => false,
        ]);
        GameVote::create([
            'game_room_id' => $room->id,
            'voter_id' => $hostPlayer->id,
            'voted_for_id' => $otherPlayer->id,
        ]);
        GameAction::create([
            'game_room_id' => $room->id,
            'player_id' => $hostPlayer->id,
            'action_type' => 'peek',
            'hour' => 3,
        ]);

        $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $this->assertEquals(0, $room->peeks()->count());
        $this->assertEquals(0, $room->votes()->count());
        $this->assertEquals(0, $room->actions()->count());
    }

    public function test_reset_clears_trio_card_reveals(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'trio', 'min_players' => 3]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create();
        $hostPlayer = GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->create();
        GamePlayer::factory()->forRoom($room)->create();

        // Create Trio-specific card reveal data
        GameCardReveal::create([
            'game_room_id' => $room->id,
            'game_player_id' => $hostPlayer->id,
            'turn_number' => 1,
            'reveal_type' => 'hand',
            'card_value' => 5,
        ]);

        $this->assertEquals(1, $room->cardReveals()->count());

        $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $this->assertEquals(0, $room->cardReveals()->count());
    }

    public function test_reset_redirects_to_waiting_room(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->finished()->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $response = $this->actingAs($host)->post(route('rooms.resetGame', [$game->slug, $room->room_code]));

        $response->assertRedirect(route('rooms.show', [$game->slug, $room->room_code]));
    }
}
