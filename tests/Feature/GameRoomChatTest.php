<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameRoomChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_player_can_send_chat_message(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($user)->forGame($game)->create();
        $player = GamePlayer::factory()->forRoom($room)->forUser($user)->host()->create();

        $response = $this->actingAs($user)->post(route('rooms.chat', $room->room_code), [
            'message' => 'Hello everyone!',
        ]);

        $response->assertStatus(200);
        $response->assertJson(['success' => true]);

        $this->assertDatabaseHas('chat_messages', [
            'game_room_id' => $room->id,
            'game_player_id' => $player->id,
            'message' => 'Hello everyone!',
        ]);
    }

    public function test_player_can_get_chat_messages(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($user)->forGame($game)->create();
        $player = GamePlayer::factory()->forRoom($room)->forUser($user)->host()->create();

        ChatMessage::create([
            'game_room_id' => $room->id,
            'game_player_id' => $player->id,
            'message' => 'Test message',
        ]);

        $response = $this->actingAs($user)->get(route('rooms.messages', $room->room_code));

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'messages');
        $response->assertJsonFragment(['message' => 'Test message']);
    }

    public function test_player_can_get_messages_after_specific_id(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($user)->forGame($game)->create();
        $player = GamePlayer::factory()->forRoom($room)->forUser($user)->host()->create();

        $message1 = ChatMessage::create([
            'game_room_id' => $room->id,
            'game_player_id' => $player->id,
            'message' => 'First message',
        ]);

        $message2 = ChatMessage::create([
            'game_room_id' => $room->id,
            'game_player_id' => $player->id,
            'message' => 'Second message',
        ]);

        $response = $this->actingAs($user)->get(route('rooms.messages', [
            'room' => $room->room_code,
            'after_id' => $message1->id,
        ]));

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'messages');
        $response->assertJsonFragment(['message' => 'Second message']);
    }

    public function test_non_player_cannot_send_message(): void
    {
        $host = User::factory()->create();
        $otherUser = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $response = $this->actingAs($otherUser)->post(route('rooms.chat', $room->room_code), [
            'message' => 'Hello!',
        ]);

        $response->assertStatus(403);
    }

    public function test_message_is_validated(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($user)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($user)->host()->create();

        $response = $this->actingAs($user)->postJson(route('rooms.chat', $room->room_code), [
            'message' => '',
        ]);

        $response->assertStatus(422);
    }

    public function test_message_is_trimmed(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($user)->forGame($game)->create();
        $player = GamePlayer::factory()->forRoom($room)->forUser($user)->host()->create();

        $response = $this->actingAs($user)->post(route('rooms.chat', $room->room_code), [
            'message' => '  Hello with spaces  ',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('chat_messages', [
            'game_room_id' => $room->id,
            'game_player_id' => $player->id,
            'message' => 'Hello with spaces',
        ]);
    }

    public function test_multiple_players_can_chat(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $game = Game::factory()->create(['max_players' => 10]);
        $room = GameRoom::factory()->withHost($user1)->forGame($game)->create();
        $player1 = GamePlayer::factory()->forRoom($room)->forUser($user1)->host()->create();
        $player2 = GamePlayer::factory()->forRoom($room)->forUser($user2)->create();

        // User 1 sends a message
        $this->actingAs($user1)->post(route('rooms.chat', $room->room_code), [
            'message' => 'Hello from user 1!',
        ]);

        // User 2 sends a message
        $this->actingAs($user2)->post(route('rooms.chat', $room->room_code), [
            'message' => 'Hi from user 2!',
        ]);

        // Verify both messages are in the database
        $this->assertDatabaseHas('chat_messages', [
            'game_room_id' => $room->id,
            'game_player_id' => $player1->id,
            'message' => 'Hello from user 1!',
        ]);
        $this->assertDatabaseHas('chat_messages', [
            'game_room_id' => $room->id,
            'game_player_id' => $player2->id,
            'message' => 'Hi from user 2!',
        ]);

        // User 2 can see both messages
        $response = $this->actingAs($user2)->get(route('rooms.messages', $room->room_code));
        $response->assertStatus(200);
        $response->assertJsonCount(2, 'messages');
    }

    public function test_chat_message_includes_player_info(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($user)->forGame($game)->create();
        $player = GamePlayer::factory()->forRoom($room)->forUser($user)->host()->create([
            'nickname' => 'TestNickname',
            'avatar_color' => '#FF5733',
        ]);

        ChatMessage::create([
            'game_room_id' => $room->id,
            'game_player_id' => $player->id,
            'message' => 'Test message',
        ]);

        $response = $this->actingAs($user)->get(route('rooms.messages', $room->room_code));

        $response->assertStatus(200);
        $response->assertJsonFragment([
            'nickname' => 'TestNickname',
            'avatar_color' => '#FF5733',
        ]);
    }
}
