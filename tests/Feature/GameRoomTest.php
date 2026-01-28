<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameRoomTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_room(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();

        $response = $this->actingAs($user)->post(route('rooms.store'), [
            'game_id' => $game->id,
            'name' => 'My Test Room',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('game_rooms', [
            'game_id' => $game->id,
            'host_user_id' => $user->id,
            'name' => 'My Test Room',
            'status' => 'waiting',
        ]);
    }

    public function test_room_code_is_generated_automatically(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();

        $this->actingAs($user)->post(route('rooms.store'), [
            'game_id' => $game->id,
        ]);

        $room = GameRoom::where('host_user_id', $user->id)->first();
        $this->assertNotNull($room);
        $this->assertEquals(6, strlen($room->room_code));
    }

    public function test_host_is_added_as_player_when_creating_room(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();

        $this->actingAs($user)->post(route('rooms.store'), [
            'game_id' => $game->id,
        ]);

        $room = GameRoom::where('host_user_id', $user->id)->first();
        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'is_host' => true,
            'is_connected' => true,
        ]);
    }

    public function test_user_can_view_room_lobby(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($user)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($user)->host()->create();

        $response = $this->actingAs($user)->get(route('rooms.show', [$game->slug, $room->room_code]));

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Rooms/Show')
            ->has('room')
            ->where('room.room_code', $room->room_code)
        );
    }

    public function test_user_can_join_room_with_code(): void
    {
        $host = User::factory()->create();
        $player = User::factory()->create();
        $game = Game::factory()->create(['max_players' => 10]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $response = $this->actingAs($player)->post(route('rooms.join.submit'), [
            'room_code' => $room->room_code,
        ]);

        $response->assertRedirect(route('rooms.show', [$game->slug, $room->room_code]));
        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'user_id' => $player->id,
            'is_connected' => true,
        ]);
    }

    public function test_user_cannot_join_full_room(): void
    {
        $host = User::factory()->create();
        $player = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2, 'max_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->create();

        $response = $this->actingAs($player)->post(route('rooms.join.submit'), [
            'room_code' => $room->room_code,
        ]);

        $response->assertSessionHasErrors('room_code');
    }

    public function test_user_cannot_join_non_waiting_room(): void
    {
        $host = User::factory()->create();
        $player = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->playing()->create();

        $response = $this->actingAs($player)->post(route('rooms.join.submit'), [
            'room_code' => $room->room_code,
        ]);

        $response->assertSessionHasErrors('room_code');
    }

    public function test_host_can_start_game_with_enough_players(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2, 'max_players' => 10]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->create();

        $response = $this->actingAs($host)->post(route('rooms.start', [$game->slug, $room->room_code]));

        $response->assertRedirect();
        $this->assertDatabaseHas('game_rooms', [
            'id' => $room->id,
            'status' => 'playing',
        ]);
    }

    public function test_non_host_cannot_start_game(): void
    {
        $host = User::factory()->create();
        $player = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 2]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->forUser($player)->create();

        $response = $this->actingAs($player)->post(route('rooms.start', [$game->slug, $room->room_code]));

        $response->assertStatus(403);
    }

    public function test_host_cannot_start_game_without_enough_players(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['min_players' => 4]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $response = $this->actingAs($host)->post(route('rooms.start', [$game->slug, $room->room_code]));

        $response->assertSessionHasErrors('error');
        $this->assertDatabaseHas('game_rooms', [
            'id' => $room->id,
            'status' => 'waiting',
        ]);
    }

    public function test_user_can_leave_room(): void
    {
        $host = User::factory()->create();
        $player = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();
        GamePlayer::factory()->forRoom($room)->forUser($player)->create();

        $response = $this->actingAs($player)->post(route('rooms.leave', [$game->slug, $room->room_code]));

        $response->assertRedirect(route('games.show', $game->slug));
        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'user_id' => $player->id,
            'is_connected' => false,
        ]);
    }

    public function test_join_room_page_can_be_rendered(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('rooms.join'));

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page->component('Rooms/Join'));
    }

    public function test_invalid_room_code_shows_error(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('rooms.join.submit'), [
            'room_code' => 'INVALID',
        ]);

        $response->assertSessionHasErrors('room_code');
    }

    public function test_guest_can_create_room_with_nickname(): void
    {
        $game = Game::factory()->create();

        $response = $this->post(route('rooms.store'), [
            'game_id' => $game->id,
            'name' => 'Guest Room',
            'nickname' => 'TestGuest',
        ]);

        $response->assertRedirect();

        $room = GameRoom::where('name', 'Guest Room')->first();
        $this->assertNotNull($room);
        $this->assertNull($room->host_user_id);

        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'user_id' => null,
            'nickname' => 'TestGuest',
            'is_host' => true,
            'is_connected' => true,
        ]);
    }

    public function test_guest_cannot_create_room_without_nickname(): void
    {
        $game = Game::factory()->create();

        $response = $this->post(route('rooms.store'), [
            'game_id' => $game->id,
            'name' => 'Guest Room',
        ]);

        $response->assertSessionHasErrors('nickname');
    }

    public function test_guest_can_join_room_with_nickname(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['max_players' => 10]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $response = $this->post(route('rooms.join.submit'), [
            'room_code' => $room->room_code,
            'nickname' => 'GuestPlayer',
        ]);

        $response->assertRedirect(route('rooms.show', [$game->slug, $room->room_code]));

        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'user_id' => null,
            'nickname' => 'GuestPlayer',
            'is_connected' => true,
        ]);
    }

    public function test_guest_cannot_join_room_without_nickname(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['max_players' => 10]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        $response = $this->post(route('rooms.join.submit'), [
            'room_code' => $room->room_code,
        ]);

        $response->assertSessionHasErrors('nickname');
    }

    public function test_guest_host_player_has_correct_attributes(): void
    {
        $game = Game::factory()->create(['min_players' => 2, 'max_players' => 10]);

        // Create room as guest (which automatically creates the host player)
        $this->post(route('rooms.store'), [
            'game_id' => $game->id,
            'nickname' => 'GuestHost',
        ]);

        $room = GameRoom::first();

        // Verify the guest host player was created correctly
        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'nickname' => 'GuestHost',
            'is_host' => true,
            'user_id' => null,
            'is_connected' => true,
        ]);

        // Verify the room has null host_user_id for guest host
        $this->assertNull($room->host_user_id);
    }

    public function test_guest_can_view_room_they_joined(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create(['max_players' => 10]);
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        // Join as guest
        $response = $this->post(route('rooms.join.submit'), [
            'room_code' => $room->room_code,
            'nickname' => 'GuestPlayer',
        ]);

        $response->assertRedirect(route('rooms.show', [$game->slug, $room->room_code]));

        // Verify the guest player was created
        $this->assertDatabaseHas('game_players', [
            'game_room_id' => $room->id,
            'nickname' => 'GuestPlayer',
            'user_id' => null,
            'is_connected' => true,
        ]);
    }

    public function test_guest_player_identified_by_session(): void
    {
        $game = Game::factory()->create(['max_players' => 10]);

        $response = $this->post(route('rooms.store'), [
            'game_id' => $game->id,
            'nickname' => 'SessionGuest',
        ]);

        $response->assertRedirect();
        $room = GameRoom::first();

        $player = GamePlayer::where('game_room_id', $room->id)
            ->where('nickname', 'SessionGuest')
            ->first();

        $this->assertNotNull($player);
        $this->assertNotNull($player->session_id);
        $this->assertNull($player->user_id);
    }

    public function test_guest_join_page_can_be_rendered(): void
    {
        $response = $this->get(route('rooms.join'));

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page->component('Rooms/Join'));
    }

    public function test_old_room_urls_redirect_to_new_format(): void
    {
        $game = Game::factory()->create(['slug' => 'trio']);
        $room = GameRoom::factory()->forGame($game)->create();

        $response = $this->get("/rooms/{$room->room_code}");

        $response->assertRedirect(route('rooms.show', [$game->slug, $room->room_code]));
        $response->assertStatus(301);
    }
}
