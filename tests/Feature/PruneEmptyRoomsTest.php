<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PruneEmptyRoomsTest extends TestCase
{
    use RefreshDatabase;

    public function test_prunes_rooms_older_than_grace_with_no_connected_players(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->disconnected()->create();

        GameRoom::where('id', $room->id)->update(['updated_at' => now()->subMinutes(10)]);

        $this->artisan('rooms:prune')->assertSuccessful();

        $this->assertDatabaseMissing('game_rooms', ['id' => $room->id]);
        $this->assertDatabaseMissing('game_players', ['game_room_id' => $room->id]);
    }

    public function test_does_not_prune_rooms_within_grace_window(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->disconnected()->create();

        $this->artisan('rooms:prune')->assertSuccessful();

        $this->assertDatabaseHas('game_rooms', ['id' => $room->id]);
    }

    public function test_does_not_prune_rooms_with_connected_players(): void
    {
        $host = User::factory()->create();
        $game = Game::factory()->create();
        $room = GameRoom::factory()->withHost($host)->forGame($game)->create();
        GamePlayer::factory()->forRoom($room)->forUser($host)->host()->create();

        GameRoom::where('id', $room->id)->update(['updated_at' => now()->subMinutes(10)]);

        $this->artisan('rooms:prune')->assertSuccessful();

        $this->assertDatabaseHas('game_rooms', ['id' => $room->id]);
    }
}
