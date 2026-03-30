<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwentyEightGameTest extends TestCase
{
    use RefreshDatabase;

    private function createGameWithPlayers(int $playerCount = 4): array
    {
        $game = Game::factory()->twentyEight()->create();
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

    public function test_game_requires_exactly_4_players(): void
    {
        $data = $this->createGameWithPlayers(3);

        $response = $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $response->assertSessionHasErrors('error');
    }

    public function test_non_host_cannot_start_game(): void
    {
        $data = $this->createGameWithPlayers(4);
        $nonHost = User::find($data['players'][1]->user_id);

        $response = $this->actingAs($nonHost)
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $response->assertStatus(403);
    }

    public function test_starting_game_deals_4_cards_per_player(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $this->assertEquals('playing', $data['room']->status);
        $this->assertEquals('bidding', $data['room']->settings['phase']);

        foreach ($data['room']->connectedPlayers as $player) {
            $this->assertCount(4, $player->game_data['hand']);
            $this->assertContains($player->game_data['team'], ['team_a', 'team_b']);
        }
    }

    public function test_starting_game_assigns_teams_correctly(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $teams = $data['room']->settings['teams'];

        $this->assertCount(2, $teams['team_a']);
        $this->assertCount(2, $teams['team_b']);

        // Players at seats 0,2 should be team_a; 1,3 should be team_b
        $playerOrder = $data['room']->settings['player_order'];
        $this->assertContains($playerOrder[0], $teams['team_a']);
        $this->assertContains($playerOrder[2], $teams['team_a']);
        $this->assertContains($playerOrder[1], $teams['team_b']);
        $this->assertContains($playerOrder[3], $teams['team_b']);
    }

    public function test_bidding_validates_minimum_bid(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $currentBidderId = $settings['player_order'][$settings['bidding']['current_bidder_index']];
        $currentBidder = GamePlayer::find($currentBidderId);
        $user = User::find($currentBidder->user_id);

        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
                'bid_value' => 10,
                'pass' => false,
            ]);

        $response->assertSessionHasErrors('bid_value');
    }

    public function test_bidding_validates_maximum_bid(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $currentBidderId = $settings['player_order'][$settings['bidding']['current_bidder_index']];
        $currentBidder = GamePlayer::find($currentBidderId);
        $user = User::find($currentBidder->user_id);

        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
                'bid_value' => 30,
                'pass' => false,
            ]);

        $response->assertSessionHasErrors('bid_value');
    }

    public function test_player_can_place_valid_bid(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $currentBidderId = $settings['player_order'][$settings['bidding']['current_bidder_index']];
        $currentBidder = GamePlayer::find($currentBidderId);
        $user = User::find($currentBidder->user_id);

        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
                'bid_value' => 15,
                'pass' => false,
            ]);

        $response->assertRedirect();
        $data['room']->refresh();
        $this->assertEquals(15, $data['room']->settings['bidding']['highest_bid']);
        $this->assertEquals($currentBidderId, $data['room']->settings['bidding']['highest_bidder_id']);
    }

    public function test_player_can_pass(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $currentBidderId = $settings['player_order'][$settings['bidding']['current_bidder_index']];
        $currentBidder = GamePlayer::find($currentBidderId);
        $user = User::find($currentBidder->user_id);

        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
                'pass' => true,
            ]);

        $response->assertRedirect();
        $data['room']->refresh();
        $this->assertContains($currentBidderId, $data['room']->settings['bidding']['passed_players']);
    }

    public function test_three_passes_ends_bidding(): void
    {
        $data = $this->createGameWithPlayers(4);

        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $playerOrder = $settings['player_order'];

        // First player bids 14
        $firstBidderIndex = $settings['bidding']['current_bidder_index'];
        $firstBidderId = $playerOrder[$firstBidderIndex];
        $user = User::find(GamePlayer::find($firstBidderId)->user_id);

        $this->actingAs($user)->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
            'bid_value' => 14,
        ]);

        // Next 3 players pass
        for ($i = 0; $i < 3; $i++) {
            $data['room']->refresh();
            $settings = $data['room']->settings;

            if ($settings['phase'] !== 'bidding') {
                break;
            }

            $currentBidderId = $playerOrder[$settings['bidding']['current_bidder_index']];
            $user = User::find(GamePlayer::find($currentBidderId)->user_id);

            $this->actingAs($user)->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
                'pass' => true,
            ]);
        }

        $data['room']->refresh();
        $this->assertEquals('trump_selection', $data['room']->settings['phase']);
        $this->assertEquals($firstBidderId, $data['room']->settings['bidding']['highest_bidder_id']);
    }

    public function test_trump_selection_stores_hidden_trump(): void
    {
        $data = $this->createGameWithPlayers(4);
        $this->startGameAndCompleteBidding($data);

        $data['room']->refresh();
        $bidWinnerId = $data['room']->settings['bidding']['highest_bidder_id'];
        $bidWinner = GamePlayer::find($bidWinnerId);
        $user = User::find($bidWinner->user_id);

        $hand = $bidWinner->game_data['hand'];
        $selectedCard = $hand[0];

        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.selectTrump', [$data['game']->slug, $data['room']->room_code]), [
                'card_index' => 0,
            ]);

        $response->assertRedirect();
        $data['room']->refresh();

        $this->assertEquals('playing', $data['room']->settings['phase']);
        $this->assertEquals($selectedCard['suit'], $data['room']->settings['trump']['suit']);
        $this->assertFalse($data['room']->settings['trump']['revealed']);
    }

    public function test_second_deal_gives_8_cards_total(): void
    {
        $data = $this->createGameWithPlayers(4);
        $this->startGameAndCompleteBidding($data);

        $data['room']->refresh();
        $bidWinnerId = $data['room']->settings['bidding']['highest_bidder_id'];
        $bidWinner = GamePlayer::find($bidWinnerId);
        $user = User::find($bidWinner->user_id);

        $this->actingAs($user)
            ->post(route('rooms.twentyEight.selectTrump', [$data['game']->slug, $data['room']->room_code]), [
                'card_index' => 0,
            ]);

        $data['room']->refresh();
        foreach ($data['room']->connectedPlayers as $player) {
            // Bid winner has 7 (4 - 1 trump + 4 new), others have 8 (4 + 4)
            $handCount = count($player->game_data['hand']);
            if ($player->id === $bidWinnerId) {
                $this->assertEquals(7, $handCount);
            } else {
                $this->assertEquals(8, $handCount);
            }
        }
    }

    public function test_wrong_player_cannot_play_card(): void
    {
        $data = $this->createGameWithPlayers(4);
        $this->startGameAndStartPlaying($data);

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $currentTurnId = $settings['current_turn_player_id'];

        // Find a player who is NOT the current turn
        $wrongPlayer = null;
        foreach ($data['players'] as $player) {
            if ($player->id !== $currentTurnId) {
                $wrongPlayer = $player;
                break;
            }
        }

        $user = User::find($wrongPlayer->user_id);
        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.playCard', [$data['game']->slug, $data['room']->room_code]), [
                'card_index' => 0,
            ]);

        $response->assertSessionHasErrors('error');
    }

    public function test_correct_player_can_play_card(): void
    {
        $data = $this->createGameWithPlayers(4);
        $this->startGameAndStartPlaying($data);

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $currentTurnId = $settings['current_turn_player_id'];
        $currentTurnPlayer = GamePlayer::find($currentTurnId);
        $user = User::find($currentTurnPlayer->user_id);

        $handBefore = count($currentTurnPlayer->game_data['hand']);

        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.playCard', [$data['game']->slug, $data['room']->room_code]), [
                'card_index' => 0,
            ]);

        $response->assertRedirect();
        $currentTurnPlayer->refresh();
        $this->assertCount($handBefore - 1, $currentTurnPlayer->game_data['hand']);

        $data['room']->refresh();
        $this->assertCount(1, $data['room']->settings['current_trick']['cards']);
    }

    public function test_cannot_call_trump_when_leading_trick(): void
    {
        $data = $this->createGameWithPlayers(4);
        $this->startGameAndStartPlaying($data);

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $currentTurnId = $settings['current_turn_player_id'];
        $currentTurnPlayer = GamePlayer::find($currentTurnId);
        $user = User::find($currentTurnPlayer->user_id);

        $response = $this->actingAs($user)
            ->post(route('rooms.twentyEight.callTrump', [$data['game']->slug, $data['room']->room_code]));

        $response->assertSessionHasErrors('error');
    }

    public function test_game_page_renders(): void
    {
        $this->withoutVite();
        $data = $this->createGameWithPlayers(4);

        $response = $this->actingAs($data['host'])
            ->get(route('rooms.show', [$data['game']->slug, $data['room']->room_code]));

        $response->assertStatus(200);
    }

    /**
     * Helper: Start game and complete bidding (first player bids 14, others pass)
     */
    private function startGameAndCompleteBidding(array $data): void
    {
        $this->actingAs($data['host'])
            ->post(route('rooms.twentyEight.start', [$data['game']->slug, $data['room']->room_code]));

        $data['room']->refresh();
        $settings = $data['room']->settings;
        $playerOrder = $settings['player_order'];

        // First bidder bids 14
        $firstBidderIndex = $settings['bidding']['current_bidder_index'];
        $firstBidderId = $playerOrder[$firstBidderIndex];
        $user = User::find(GamePlayer::find($firstBidderId)->user_id);

        $this->actingAs($user)->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
            'bid_value' => 14,
        ]);

        // Remaining players pass
        for ($i = 0; $i < 3; $i++) {
            $data['room']->refresh();
            $settings = $data['room']->settings;

            if ($settings['phase'] !== 'bidding') {
                break;
            }

            $currentBidderId = $playerOrder[$settings['bidding']['current_bidder_index']];
            $user = User::find(GamePlayer::find($currentBidderId)->user_id);

            $this->actingAs($user)->post(route('rooms.twentyEight.placeBid', [$data['game']->slug, $data['room']->room_code]), [
                'pass' => true,
            ]);
        }
    }

    /**
     * Helper: Start game, complete bidding, select trump, and enter playing phase
     */
    private function startGameAndStartPlaying(array $data): void
    {
        $this->startGameAndCompleteBidding($data);

        $data['room']->refresh();
        $bidWinnerId = $data['room']->settings['bidding']['highest_bidder_id'];
        $user = User::find(GamePlayer::find($bidWinnerId)->user_id);

        $this->actingAs($user)
            ->post(route('rooms.twentyEight.selectTrump', [$data['game']->slug, $data['room']->room_code]), [
                'card_index' => 0,
            ]);
    }
}
