<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VoiceAutoConnectTest extends TestCase
{
    use RefreshDatabase;

    public function test_players_start_muted_by_default(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        $player = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_connected' => true,
        ]);

        // Verify player starts muted
        $this->assertTrue($player->is_muted);
    }

    public function test_toggle_mute_updates_player_state(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        $player = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_connected' => true,
            'is_muted' => true,
        ]);

        $response = $this->actingAs($user)->postJson(
            route('rooms.voice.toggleMute', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'is_muted' => false,
            ]);

        // Verify database was updated
        $this->assertFalse($player->fresh()->is_muted);

        // Toggle again to mute
        $response = $this->actingAs($user)->postJson(
            route('rooms.voice.toggleMute', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'is_muted' => true,
            ]);

        $this->assertTrue($player->fresh()->is_muted);
    }

    public function test_voice_status_returns_all_connected_players_with_mute_state(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        $player1 = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user1->id,
            'is_connected' => true,
            'is_muted' => true,
            'nickname' => 'Player1',
        ]);

        $player2 = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user2->id,
            'is_connected' => true,
            'is_muted' => false,
            'nickname' => 'Player2',
        ]);

        // Create a disconnected player who should not appear
        GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'is_connected' => false,
        ]);

        $response = $this->actingAs($user1)->getJson(
            route('rooms.voice.status', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(200)
            ->assertJsonCount(2, 'players')
            ->assertJsonFragment([
                'id' => $player1->id,
                'nickname' => 'Player1',
                'is_muted' => true,
            ])
            ->assertJsonFragment([
                'id' => $player2->id,
                'nickname' => 'Player2',
                'is_muted' => false,
            ]);
    }

    public function test_non_player_cannot_toggle_mute(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_connected' => true,
        ]);

        // Other user is not a player in this room
        $response = $this->actingAs($otherUser)->postJson(
            route('rooms.voice.toggleMute', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(403);
    }

    public function test_non_player_cannot_get_voice_status(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_connected' => true,
        ]);

        // Other user is not a player in this room
        $response = $this->actingAs($otherUser)->getJson(
            route('rooms.voice.status', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(403);
    }

    public function test_players_start_with_video_disabled_by_default(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        $player = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_connected' => true,
        ]);

        // Verify player starts with video disabled
        $this->assertFalse($player->is_video_enabled);
    }

    public function test_toggle_video_updates_player_state(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        $player = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_connected' => true,
            'is_video_enabled' => false,
        ]);

        $response = $this->actingAs($user)->postJson(
            route('rooms.voice.toggleVideo', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'is_video_enabled' => true,
            ]);

        // Verify database was updated
        $this->assertTrue($player->fresh()->is_video_enabled);

        // Toggle again to disable
        $response = $this->actingAs($user)->postJson(
            route('rooms.voice.toggleVideo', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'is_video_enabled' => false,
            ]);

        $this->assertFalse($player->fresh()->is_video_enabled);
    }

    public function test_voice_status_includes_video_enabled_state(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        $player1 = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user1->id,
            'is_connected' => true,
            'is_video_enabled' => true,
            'nickname' => 'Player1',
        ]);

        $player2 = GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user2->id,
            'is_connected' => true,
            'is_video_enabled' => false,
            'nickname' => 'Player2',
        ]);

        $response = $this->actingAs($user1)->getJson(
            route('rooms.voice.status', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(200)
            ->assertJsonFragment([
                'id' => $player1->id,
                'nickname' => 'Player1',
                'is_video_enabled' => true,
            ])
            ->assertJsonFragment([
                'id' => $player2->id,
                'nickname' => 'Player2',
                'is_video_enabled' => false,
            ]);
    }

    public function test_non_player_cannot_toggle_video(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $game = Game::factory()->create(['slug' => 'test-game']);
        $room = GameRoom::factory()->create([
            'game_id' => $game->id,
            'room_code' => 'TEST123',
        ]);

        GamePlayer::factory()->create([
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_connected' => true,
        ]);

        // Other user is not a player in this room
        $response = $this->actingAs($otherUser)->postJson(
            route('rooms.voice.toggleVideo', ['game' => $game->slug, 'room' => $room->room_code])
        );

        $response->assertStatus(403);
    }
}
