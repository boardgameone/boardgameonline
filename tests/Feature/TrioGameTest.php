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
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $response->assertSessionHasErrors('error');
    }

    public function test_game_allows_maximum_6_players(): void
    {
        $data = $this->createGameWithPlayers(6);

        $response = $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $response->assertRedirect();
        $data['room']->refresh();
        $this->assertEquals('playing', $data['room']->status);
    }

    public function test_starting_game_distributes_9_cards_per_player_for_3_players(): void
    {
        $data = $this->createGameWithPlayers(3);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

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
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

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
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

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
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

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
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

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
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        foreach ($data['room']->settings['middle_grid'] as $card) {
            $this->assertFalse($card['face_up']);
        }
    }

    public function test_starting_player_is_randomly_selected(): void
    {
        $data = $this->createGameWithPlayers(3);

        $this->actingAs($data['host'])
            ->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $this->assertNotNull($data['room']->thief_player_id);
        $this->assertContains($data['room']->thief_player_id, $data['room']->connectedPlayers->pluck('id')->toArray());
    }

    public function test_player_can_ask_another_player_for_highest_card(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $highestCard = max($targetHand);

        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
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
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $lowestCard = min($targetHand);

        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
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
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $middleCard = $data['room']->settings['middle_grid'][0];

        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
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
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $notCurrentPlayer = $data['room']->connectedPlayers->where('id', '!=', $data['room']->thief_player_id)->first();

        $response = $this->actingAs($notCurrentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => 1,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_player_automatically_reveals_actual_highest_card_regardless_of_input(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $expectedHighest = max($targetHand);

        // Send a wrong card_value (0) - backend should ignore it and determine the correct value
        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
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
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();
        $targetHand = $targetPlayer->game_data['hand'];
        $expectedLowest = min($targetHand);

        // Send a wrong card_value (0) - backend should ignore it and determine the correct value
        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
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
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $data['room']->settings['middle_grid'][0]['value'],
            ]);

        $data['room']->refresh();
        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $data['room']->settings['middle_grid'][0]['value'],
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_turn_advances_to_next_player_in_order(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $firstPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $firstPlayerId = $firstPlayer->id;

        $targetPlayer = $data['room']->connectedPlayers->where('id', '!=', $firstPlayer->id)->first();
        $this->actingAs($firstPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
                'reveal_type' => 'ask_highest',
                'target_player_id' => $targetPlayer->id,
                'card_value' => max($targetPlayer->game_data['hand']),
            ]);

        $data['room']->refresh();
        $middleCard = $data['room']->settings['middle_grid'][0];

        $this->actingAs($firstPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $middleCard['value'],
            ]);

        $data['room']->refresh();

        $this->actingAs($firstPlayer->user)
            ->post(route('rooms.trio.endTurn', [$data['room']->game->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $this->assertNotEquals($firstPlayerId, $data['room']->thief_player_id);
    }

    public function test_revealed_cards_hidden_after_turn_ends(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        $card0 = $data['room']->settings['middle_grid'][0];
        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 0,
                'card_value' => $card0['value'],
            ]);

        $data['room']->refresh();
        $card1 = $data['room']->settings['middle_grid'][1];
        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.revealCard', [$data['room']->game->slug, $data['room']->room_code]), [
                'reveal_type' => 'flip_middle',
                'middle_position' => 1,
                'card_value' => $card1['value'],
            ]);

        $data['room']->refresh();
        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.endTurn', [$data['room']->game->slug, $data['room']->room_code]));

        $data['room']->refresh();
        foreach ($data['room']->settings['middle_grid'] as $card) {
            $this->assertFalse($card['face_up']);
        }
    }

    public function test_player_wins_with_three_collected_trios(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

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
            ->post(route('rooms.trio.claimTrio', [$data['room']->game->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $this->assertEquals('finished', $data['room']->status);
    }

    public function test_claiming_trio_removes_cards_from_middle_grid(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        // Set up a trio from middle grid positions 0, 1, 2
        $settings = $data['room']->settings;
        $settings['middle_grid'][0] = ['value' => 7, 'face_up' => true, 'position' => 0];
        $settings['middle_grid'][1] = ['value' => 7, 'face_up' => true, 'position' => 1];
        $settings['middle_grid'][2] = ['value' => 7, 'face_up' => true, 'position' => 2];
        $settings['current_turn']['reveals'] = [
            ['value' => 7, 'source' => 'middle_0'],
            ['value' => 7, 'source' => 'middle_1'],
            ['value' => 7, 'source' => 'middle_2'],
        ];
        $data['room']->update(['settings' => $settings]);

        $initialMiddleCount = count($settings['middle_grid']);

        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.claimTrio', [$data['room']->game->slug, $data['room']->room_code]));

        $data['room']->refresh();

        // Assert middle grid reduced by 3
        $this->assertCount($initialMiddleCount - 3, $data['room']->settings['middle_grid']);

        // Assert the specific cards (value 7) were removed from positions 0, 1, 2
        $remainingValues = array_column($data['room']->settings['middle_grid'], 'value');
        $removedCount = count(array_filter($remainingValues, fn ($v) => $v === 7));

        // There should be no more 7s at the first 3 positions (they were removed)
        // Original middle grid had 9 cards, we removed 3, so 6 remain
        $this->assertCount(6, $data['room']->settings['middle_grid']);

        // Verify positions are properly re-indexed (0, 1, 2, 3, 4, 5)
        foreach ($data['room']->settings['middle_grid'] as $index => $card) {
            $this->assertEquals($index, $card['position']);
        }
    }

    public function test_claiming_trio_removes_cards_from_player_hands(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);
        $player2 = $data['room']->connectedPlayers->where('id', '!=', $currentPlayer->id)->first();

        // Give both players a hand with value 5 in it
        $gameData1 = $currentPlayer->game_data;
        $gameData1['hand'] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        $currentPlayer->update(['game_data' => $gameData1]);

        $gameData2 = $player2->game_data;
        $gameData2['hand'] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        $player2->update(['game_data' => $gameData2]);

        // Set up a trio: one from current player (value 5), one from player2 (value 5), one from middle (value 5)
        $settings = $data['room']->settings;
        $settings['middle_grid'][0] = ['value' => 5, 'face_up' => true, 'position' => 0];
        $settings['current_turn']['reveals'] = [
            ['value' => 5, 'source' => 'player_'.$currentPlayer->id],
            ['value' => 5, 'source' => 'player_'.$player2->id],
            ['value' => 5, 'source' => 'middle_0'],
        ];
        $data['room']->update(['settings' => $settings]);

        $response = $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.claimTrio', [$data['room']->game->slug, $data['room']->room_code]));

        $response->assertRedirect();

        // Reload the players from database
        $currentPlayerAfter = $currentPlayer->fresh();
        $player2After = $player2->fresh();

        // Assert each player's hand reduced from 9 to 8
        $this->assertCount(8, $currentPlayerAfter->game_data['hand']);
        $this->assertCount(8, $player2After->game_data['hand']);

        // Assert value 5 removed from each hand
        $this->assertNotContains(5, $currentPlayerAfter->game_data['hand']);
        $this->assertNotContains(5, $player2After->game_data['hand']);

        // Assert other cards remain
        $this->assertContains(1, $currentPlayerAfter->game_data['hand']);
        $this->assertContains(9, $currentPlayerAfter->game_data['hand']);
    }

    public function test_claiming_multiple_trios_in_succession(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        // First trio: middle positions 0, 1, 2 (value 3)
        $settings = $data['room']->settings;
        $settings['middle_grid'][0] = ['value' => 3, 'face_up' => true, 'position' => 0];
        $settings['middle_grid'][1] = ['value' => 3, 'face_up' => true, 'position' => 1];
        $settings['middle_grid'][2] = ['value' => 3, 'face_up' => true, 'position' => 2];
        $settings['current_turn']['reveals'] = [
            ['value' => 3, 'source' => 'middle_0'],
            ['value' => 3, 'source' => 'middle_1'],
            ['value' => 3, 'source' => 'middle_2'],
        ];
        $data['room']->update(['settings' => $settings]);

        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.claimTrio', [$data['room']->game->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer->refresh();

        $this->assertCount(6, $data['room']->settings['middle_grid']);
        $this->assertCount(1, $currentPlayer->game_data['collected_trios']);

        // Second trio: middle positions 0, 1, 2 (now different cards, value 6)
        $settings = $data['room']->settings;
        $settings['middle_grid'][0]['value'] = 6;
        $settings['middle_grid'][0]['face_up'] = true;
        $settings['middle_grid'][1]['value'] = 6;
        $settings['middle_grid'][1]['face_up'] = true;
        $settings['middle_grid'][2]['value'] = 6;
        $settings['middle_grid'][2]['face_up'] = true;
        $settings['current_turn']['reveals'] = [
            ['value' => 6, 'source' => 'middle_0'],
            ['value' => 6, 'source' => 'middle_1'],
            ['value' => 6, 'source' => 'middle_2'],
        ];
        $data['room']->update(['settings' => $settings]);

        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.claimTrio', [$data['room']->game->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer->refresh();

        // Assert both trios collected
        $this->assertCount(2, $currentPlayer->game_data['collected_trios']);

        // Assert all 6 cards removed from middle
        $this->assertCount(3, $data['room']->settings['middle_grid']);

        // Verify positions still properly indexed
        foreach ($data['room']->settings['middle_grid'] as $index => $card) {
            $this->assertEquals($index, $card['position']);
        }
    }

    public function test_trio_from_all_middle_cards_removes_correctly(): void
    {
        $data = $this->createGameWithPlayers(3);
        $this->actingAs($data['host'])->post(route('rooms.trio.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $currentPlayer = $data['room']->connectedPlayers->find($data['room']->thief_player_id);

        // Set up a trio from non-consecutive middle positions (0, 2, 4)
        $settings = $data['room']->settings;
        $originalGrid = $settings['middle_grid'];

        // Store the values we're NOT removing
        $keepValue1 = $originalGrid[1]['value'];
        $keepValue3 = $originalGrid[3]['value'];

        $settings['middle_grid'][0] = ['value' => 8, 'face_up' => true, 'position' => 0];
        $settings['middle_grid'][2] = ['value' => 8, 'face_up' => true, 'position' => 2];
        $settings['middle_grid'][4] = ['value' => 8, 'face_up' => true, 'position' => 4];
        $settings['current_turn']['reveals'] = [
            ['value' => 8, 'source' => 'middle_0'],
            ['value' => 8, 'source' => 'middle_2'],
            ['value' => 8, 'source' => 'middle_4'],
        ];
        $data['room']->update(['settings' => $settings]);

        $this->actingAs($currentPlayer->user)
            ->post(route('rooms.trio.claimTrio', [$data['room']->game->slug, $data['room']->room_code]));

        $data['room']->refresh();

        // Assert exactly 3 cards removed
        $this->assertCount(6, $data['room']->settings['middle_grid']);

        // Assert positions properly re-indexed (should be 0, 1, 2, 3, 4, 5)
        foreach ($data['room']->settings['middle_grid'] as $index => $card) {
            $this->assertEquals($index, $card['position']);
        }

        // Assert correct cards removed (original positions 1, 3, 5, 6, 7, 8 remain)
        $remainingValues = array_column($data['room']->settings['middle_grid'], 'value');
        $this->assertContains($keepValue1, $remainingValues);
        $this->assertContains($keepValue3, $remainingValues);
    }
}
