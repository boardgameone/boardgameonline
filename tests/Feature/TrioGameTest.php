<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrioGameTest extends TestCase
{
    use RefreshDatabase;

    private function createGameWithPlayers(int $playerCount): array
    {
        $game = Game::factory()->trio()->create();
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

    public function test_game_requires_minimum_3_players(): void
    {
        $data = $this->createGameWithPlayers(2);

        $response = $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $response->assertSessionHasErrors('error');
    }

    public function test_game_allows_maximum_6_players(): void
    {
        $data = $this->createGameWithPlayers(6);

        $response = $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $response->assertRedirect();
        $data['room']->refresh();
        $this->assertEquals('playing', $data['room']->status);
    }

    public function test_starting_game_distributes_9_cards_per_player_for_3_players(): void
    {
        $data = $this->createGameWithPlayers(3);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        foreach ($data['room']->connectedPlayers as $player) {
            $this->assertCount(9, $player->game_data['hand']);
        }

        $this->assertCount(9, $data['room']->settings['middle_grid']);
    }

    public function test_starting_game_distributes_7_cards_per_player_for_4_players(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        foreach ($data['room']->connectedPlayers as $player) {
            $this->assertCount(7, $player->game_data['hand']);
        }

        $this->assertCount(7, $data['room']->settings['middle_grid']);
    }

    public function test_starting_game_distributes_6_cards_per_player_for_5_players(): void
    {
        $data = $this->createGameWithPlayers(5);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        foreach ($data['room']->connectedPlayers as $player) {
            $this->assertCount(6, $player->game_data['hand']);
        }

        $this->assertCount(6, $data['room']->settings['middle_grid']);
    }

    public function test_starting_game_distributes_5_cards_per_player_for_6_players(): void
    {
        $data = $this->createGameWithPlayers(6);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        foreach ($data['room']->connectedPlayers as $player) {
            $this->assertCount(5, $player->game_data['hand']);
        }

        $this->assertCount(5, $data['room']->settings['middle_grid']);
    }

    public function test_player_hands_are_sorted_lowest_to_highest(): void
    {
        $data = $this->createGameWithPlayers(3);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        foreach ($data['room']->connectedPlayers as $player) {
            $hand = $player->game_data['hand'];
            $sorted = $hand;
            sort($sorted);
            $this->assertEquals($sorted, $hand);
        }
    }

    public function test_middle_grid_cards_start_face_down(): void
    {
        $data = $this->createGameWithPlayers(3);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        foreach ($data['room']->settings['middle_grid'] as $card) {
            $this->assertFalse($card['face_up']);
        }
    }

    public function test_starting_player_is_randomly_selected(): void
    {
        $data = $this->createGameWithPlayers(3);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $this->assertNotNull($data['room']->thief_player_id);
        $this->assertContains($data['room']->thief_player_id, $data['room']->connectedPlayers->pluck('id')->toArray());
    }

    public function test_player_can_ask_another_player_for_highest_card(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $highestCard = max($targetHand);

        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'ask_highest',
                'target_player_id' => $targetPlayer->id,
                'card_value' => $highestCard,
            ]);

        $response->assertRedirect();
        $data['room']->refresh();
        $this->assertCount(1, $data['room']->settings['current_turn']['reveals']);
        $this->assertEquals($highestCard, $data['room']->settings['current_turn']['reveals'][0]['value']);
    }

    public function test_player_can_ask_another_player_for_lowest_card(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $lowestCard = min($targetHand);

        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'ask_lowest',
                'target_player_id' => $targetPlayer->id,
                'card_value' => $lowestCard,
            ]);

        $response->assertRedirect();
        $data['room']->refresh();
        $this->assertCount(1, $data['room']->settings['current_turn']['reveals']);
        $this->assertEquals($lowestCard, $data['room']->settings['current_turn']['reveals'][0]['value']);
    }

    public function test_player_can_flip_middle_card(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $middleCard = $data['room']->settings['middle_grid'][0];

        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $middleCard['value'],
            ]);

        $response->assertRedirect();
        $data['room']->refresh();
        $this->assertTrue($data['room']->settings['middle_grid'][0]['face_up']);
        $this->assertCount(1, $data['room']->settings['current_turn']['reveals']);
    }

    public function test_player_cannot_reveal_out_of_turn(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $notCurrentPlayer = $data['room']->connectedPlayers->where('id', '!=', $data['room']->thief_player_id)->first();

        $response = $this->actingAs($notCurrentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => 1,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_player_automatically_reveals_actual_highest_card_regardless_of_input(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $expectedHighest = max($targetHand);

        // Send a wrong card_value (0) - backend should ignore it and determine the correct value
        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'ask_highest',
                'target_player_id' => $targetPlayer->id,
                'card_value' => 0,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('game_card_reveals', [
            'reveal_type' => 'ask_highest',
            'card_value' => $expectedHighest,
            'target_player_id' => $targetPlayer->id,
        ]);
    }

    public function test_player_automatically_reveals_actual_lowest_card_regardless_of_input(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $expectedLowest = min($targetHand);

        // Send a wrong card_value (0) - backend should ignore it and determine the correct value
        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'ask_lowest',
                'target_player_id' => $targetPlayer->id,
                'card_value' => 0,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('game_card_reveals', [
            'reveal_type' => 'ask_lowest',
            'card_value' => $expectedLowest,
            'target_player_id' => $targetPlayer->id,
        ]);
    }

    public function test_player_cannot_flip_already_face_up_middle_card(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $data['room']->settings['middle_grid'][0]['value'],
            ]);

        $data['room']->refresh();
        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $data['room']->settings['middle_grid'][0]['value'],
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_turn_advances_to_next_player_in_order(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $firstPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $firstPlayerId = $firstPlayer->id;

        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $firstPlayer->id)->first();
        $this->actingAs($firstPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'ask_highest',
                'target_player_id' => $targetPlayer->id,
                'card_value' => max($targetPlayer->game_data['hand']),
            ]);

        $data['room']->refresh();
        $middleCard = $data['room']->settings['middle_grid'][0];

        $this->actingAs($firstPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $middleCard['value'],
            ]);

        $data['room']->refresh();

        $this->actingAs($firstPlayer->user)
            ->post(route('rooms.trio.endTurn', $data['room']->room_code));

        $data['room']->refresh();
        $this->assertNotEquals($firstPlayerId, $data['room']->thief_player_id);
    }

    public function test_revealed_cards_hidden_after_turn_ends(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        $card0 = $data['room']->settings['middle_grid'][0];
        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $card0['value'],
            ]);

        $data['room']->refresh();
        $card1 = $data['room']->settings['middle_grid'][1];
        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', $data['room']->room_code), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 1,
                'card_value' => $card1['value'],
            ]);

        $data['room']->refresh();
        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.endTurn', $data['room']->room_code));

        $data['room']->refresh();
        foreach ($data['room']->settings['middle_grid'] as $card) {
            $this->assertFalse($card['face_up']);
        }
    }

    public function test_player_wins_with_three_collected_trios(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', $data['room']->room_code));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        $gameData = $currentPlayer->game_data;
        $gameData['collected_trios'] = [[1, 1, 1], [2, 2, 2]];
        $currentPlayer->update(['game_data' => $gameData]);

        $settings = $data['room']->settings;
        $settings['current_turn']['reveals'] = [
            ['value' => 5, 'source' => 'middle_0'],
            ['value' => 5, 'source' => 'middle_1'],
            ['value' => 5, 'source' => 'middle_2'],
        ];
        $data['room']->update(['settings' => $settings]);

        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.claimTrio', $data['room']->room_code));

        $data['room']->refresh();
        $this->assertEquals('finished', $data['room']->status);
    }
}
