<?php

namespace App\Http\Controllers;

use App\Http\Requests\PlaceBidRequest;
use App\Http\Requests\PlayCardRequest;
use App\Http\Requests\SelectTrumpRequest;
use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class TwentyEightGameController extends Controller
{
    private const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

    private const RANKS = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];

    /** @var array<string, int> */
    private const CARD_POINTS = [
        'J' => 3,
        '9' => 2,
        'A' => 1,
        '10' => 1,
        'K' => 0,
        'Q' => 0,
        '8' => 0,
        '7' => 0,
    ];

    /** @var array<string, int> */
    private const CARD_STRENGTH = [
        'J' => 8,
        '9' => 7,
        'A' => 6,
        '10' => 5,
        'K' => 4,
        'Q' => 3,
        '8' => 2,
        '7' => 1,
    ];

    public function show(Game $game, GameRoom $room): Response
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $room->load([
            'game',
            'host:id,name',
            'players' => function ($query) {
                $query->orderBy('created_at');
            },
        ]);

        $currentPlayer = $this->findCurrentPlayer($room);
        $gameState = $this->buildGameState($room, $currentPlayer);

        return Inertia::render('Rooms/TwentyEightGame', [
            'room' => $room,
            'currentPlayer' => $currentPlayer,
            'isHost' => $currentPlayer?->is_host ?? false,
            'gameState' => $gameState,
        ]);
    }

    public function start(Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer?->is_host) {
            abort(403, 'Only the host can start the game.');
        }

        if (! $room->canStart()) {
            return back()->withErrors(['error' => 'Cannot start game. Need exactly 4 players.']);
        }

        $connectedPlayers = $room->connectedPlayers()->orderBy('created_at')->get();

        if ($connectedPlayers->count() !== 4) {
            return back()->withErrors(['error' => 'Need exactly 4 players.']);
        }

        $playerOrder = $connectedPlayers->pluck('id')->values()->all();

        // Teams: seats 0&2 vs 1&3
        $teams = [
            'team_a' => [$playerOrder[0], $playerOrder[2]],
            'team_b' => [$playerOrder[1], $playerOrder[3]],
        ];

        // Generate and shuffle deck
        $deck = $this->generateDeck();
        shuffle($deck);

        // Deal first 4 cards to each player
        foreach ($connectedPlayers as $index => $player) {
            $hand = array_slice($deck, $index * 4, 4);
            $team = in_array($player->id, $teams['team_a']) ? 'team_a' : 'team_b';

            $player->update([
                'game_data' => [
                    'hand' => $hand,
                    'team' => $team,
                    'seat_position' => $index,
                ],
            ]);
        }

        $remainingDeck = array_slice($deck, 16);
        $dealerIndex = 0;
        // Bidding starts from player to dealer's right (next player in order)
        $firstBidderIndex = ($dealerIndex + 1) % 4;

        $room->update([
            'status' => 'playing',
            'started_at' => now(),
            'settings' => [
                'phase' => 'bidding',
                'round_number' => 1,
                'dealer_index' => $dealerIndex,
                'teams' => $teams,
                'player_order' => $playerOrder,
                'remaining_deck' => $remainingDeck,
                'bidding' => [
                    'current_bidder_index' => $firstBidderIndex,
                    'highest_bid' => 0,
                    'highest_bidder_id' => null,
                    'passed_players' => [],
                    'first_round_complete' => false,
                ],
                'trump' => [
                    'suit' => null,
                    'card' => null,
                    'revealed' => false,
                    'holder_id' => null,
                ],
                'current_trick' => [
                    'number' => 1,
                    'lead_player_id' => null,
                    'cards' => [],
                    'lead_suit' => null,
                ],
                'current_turn_player_id' => $playerOrder[$firstBidderIndex],
                'tricks_completed' => [],
                'points' => ['team_a' => 0, 'team_b' => 0],
                'game_scores' => ['team_a' => 0, 'team_b' => 0],
                'bid_value' => 0,
                'bid_team' => null,
                'round_history' => [],
            ],
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function placeBid(PlaceBidRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        $settings = $room->settings;

        if ($settings['phase'] !== 'bidding') {
            return back()->withErrors(['error' => 'Not in bidding phase.']);
        }

        $bidding = $settings['bidding'];
        $playerOrder = $settings['player_order'];
        $expectedPlayerId = $playerOrder[$bidding['current_bidder_index']];

        if ($currentPlayer->id !== $expectedPlayerId) {
            return back()->withErrors(['error' => 'It is not your turn to bid.']);
        }

        if (in_array($currentPlayer->id, $bidding['passed_players'])) {
            return back()->withErrors(['error' => 'You have already passed.']);
        }

        $isPassing = $request->boolean('pass');
        $bidValue = $request->validated('bid_value');

        if ($isPassing) {
            $bidding['passed_players'][] = $currentPlayer->id;
        } else {
            if (! $bidValue) {
                return back()->withErrors(['error' => 'You must place a bid or pass.']);
            }

            if ($bidValue < 14 || $bidValue > 28) {
                return back()->withErrors(['error' => 'Bid must be between 14 and 28.']);
            }

            if ($bidValue <= $bidding['highest_bid']) {
                return back()->withErrors(['error' => 'Bid must be higher than current bid of '.$bidding['highest_bid'].'.']);
            }

            $bidding['highest_bid'] = $bidValue;
            $bidding['highest_bidder_id'] = $currentPlayer->id;
        }

        // Count active bidders (not passed)
        $activeBidders = array_filter($playerOrder, function ($playerId) use ($bidding) {
            return ! in_array($playerId, $bidding['passed_players']);
        });

        // Bidding ends when only 1 active bidder remains
        if (count($activeBidders) <= 1) {
            // If no one bid at all, dealer is forced to bid 14
            if ($bidding['highest_bidder_id'] === null) {
                $dealerPlayerId = $playerOrder[$settings['dealer_index']];
                $bidding['highest_bidder_id'] = $dealerPlayerId;
                $bidding['highest_bid'] = 14;
            }

            $settings['bidding'] = $bidding;
            $settings['phase'] = 'trump_selection';
            $settings['current_turn_player_id'] = $bidding['highest_bidder_id'];
            $settings['bid_value'] = $bidding['highest_bid'];

            // Determine bid team
            $bidWinnerId = $bidding['highest_bidder_id'];
            $settings['bid_team'] = in_array($bidWinnerId, $settings['teams']['team_a']) ? 'team_a' : 'team_b';

            $room->update(['settings' => $settings]);

            return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
        }

        // Move to next bidder (skip passed players)
        $nextIndex = ($bidding['current_bidder_index'] + 1) % 4;
        while (in_array($playerOrder[$nextIndex], $bidding['passed_players'])) {
            $nextIndex = ($nextIndex + 1) % 4;
        }

        $bidding['current_bidder_index'] = $nextIndex;
        $settings['bidding'] = $bidding;
        $settings['current_turn_player_id'] = $playerOrder[$nextIndex];

        $room->update(['settings' => $settings]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function selectTrump(SelectTrumpRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        $settings = $room->settings;

        if ($settings['phase'] !== 'trump_selection') {
            return back()->withErrors(['error' => 'Not in trump selection phase.']);
        }

        if ($currentPlayer->id !== $settings['bidding']['highest_bidder_id']) {
            return back()->withErrors(['error' => 'Only the bid winner can select trump.']);
        }

        $cardIndex = $request->validated('card_index');
        $hand = $currentPlayer->game_data['hand'] ?? [];

        if ($cardIndex >= count($hand)) {
            return back()->withErrors(['error' => 'Invalid card selection.']);
        }

        $trumpCard = $hand[$cardIndex];

        // Store trump info (hidden from other players)
        $settings['trump'] = [
            'suit' => $trumpCard['suit'],
            'card' => $trumpCard,
            'revealed' => false,
            'holder_id' => $currentPlayer->id,
        ];

        // Remove trump card from hand
        array_splice($hand, $cardIndex, 1);
        $gameData = $currentPlayer->game_data;
        $gameData['hand'] = $hand;
        $currentPlayer->update(['game_data' => $gameData]);

        // Deal remaining 4 cards to each player
        $remainingDeck = $settings['remaining_deck'];
        $playerOrder = $settings['player_order'];
        $players = $room->connectedPlayers()->orderBy('created_at')->get();

        foreach ($players as $index => $player) {
            $newCards = array_slice($remainingDeck, $index * 4, 4);
            $playerData = $player->game_data;
            $playerData['hand'] = array_merge($playerData['hand'], $newCards);
            $player->update(['game_data' => $playerData]);
        }

        // Set up playing phase
        // Bid winner leads the first trick
        $bidWinnerId = $settings['bidding']['highest_bidder_id'];
        $settings['phase'] = 'playing';
        $settings['remaining_deck'] = [];
        $settings['current_trick'] = [
            'number' => 1,
            'lead_player_id' => $bidWinnerId,
            'cards' => [],
            'lead_suit' => null,
        ];
        $settings['current_turn_player_id'] = $bidWinnerId;

        $room->update(['settings' => $settings]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function playCard(PlayCardRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        return DB::transaction(function () use ($request, $game, $room, $currentPlayer) {
            $currentPlayer = GamePlayer::query()->lockForUpdate()->find($currentPlayer->id);
            $room = GameRoom::query()->lockForUpdate()->find($room->id);

            $settings = $room->settings;

            if ($settings['phase'] !== 'playing') {
                return back()->withErrors(['error' => 'Not in playing phase.']);
            }

            if ($currentPlayer->id !== $settings['current_turn_player_id']) {
                return back()->withErrors(['error' => 'It is not your turn.']);
            }

            $cardIndex = $request->validated('card_index');
            $hand = $currentPlayer->game_data['hand'] ?? [];

            if ($cardIndex >= count($hand)) {
                return back()->withErrors(['error' => 'Invalid card selection.']);
            }

            $card = $hand[$cardIndex];
            $trick = $settings['current_trick'];
            $trumpSuit = $settings['trump']['suit'];
            $trumpRevealed = $settings['trump']['revealed'];

            // Validate follow-suit rule
            if (! empty($trick['cards'])) {
                $leadSuit = $trick['lead_suit'];
                $hasLeadSuit = $this->playerHasSuit($hand, $leadSuit);

                if ($hasLeadSuit && $card['suit'] !== $leadSuit) {
                    return back()->withErrors(['error' => 'You must follow suit.']);
                }

                // If player doesn't have lead suit and trump not revealed, they must call trump first
                if (! $hasLeadSuit && ! $trumpRevealed && $card['suit'] === $trumpSuit) {
                    // Auto-reveal trump when playing a trump card without lead suit
                    $settings['trump']['revealed'] = true;
                    $trumpRevealed = true;

                    // Return trump card to holder's hand
                    $holderId = $settings['trump']['holder_id'];
                    if ($holderId && $settings['trump']['card']) {
                        $holder = GamePlayer::find($holderId);
                        if ($holder) {
                            $holderData = $holder->game_data;
                            $holderData['hand'][] = $settings['trump']['card'];
                            $holder->update(['game_data' => $holderData]);

                            // If the current player is the trump holder, refresh their hand
                            if ($holder->id === $currentPlayer->id) {
                                $currentPlayer->refresh();
                                $hand = $currentPlayer->game_data['hand'] ?? [];
                                // Re-find the card index since hand changed
                                $cardIndex = $this->findCardIndex($hand, $card);
                                if ($cardIndex === null) {
                                    return back()->withErrors(['error' => 'Card not found after trump reveal.']);
                                }
                            }
                        }
                        $settings['trump']['card'] = null;
                    }
                }
            }

            // Play the card
            $trick['cards'][] = [
                'player_id' => $currentPlayer->id,
                'card' => $card,
            ];

            if (empty($trick['lead_suit'])) {
                $trick['lead_suit'] = $card['suit'];
            }

            // Remove card from hand
            array_splice($hand, $cardIndex, 1);
            $gameData = $currentPlayer->game_data;
            $gameData['hand'] = $hand;
            $currentPlayer->update(['game_data' => $gameData]);

            $settings['current_trick'] = $trick;

            // Check if trick is complete (4 cards played)
            if (count($trick['cards']) === 4) {
                $winnerId = $this->determineTrickWinner(
                    $trick['cards'],
                    $trumpSuit,
                    $trumpRevealed
                );

                $trickPoints = $this->calculateTrickPoints($trick['cards']);

                // Determine winner's team
                $winnerTeam = in_array($winnerId, $settings['teams']['team_a']) ? 'team_a' : 'team_b';
                $settings['points'][$winnerTeam] += $trickPoints;

                // Store completed trick
                $settings['tricks_completed'][] = [
                    'number' => $trick['number'],
                    'cards' => $trick['cards'],
                    'winner_id' => $winnerId,
                    'points' => $trickPoints,
                ];

                // Check if round is over (8 tricks)
                if ($trick['number'] >= 8) {
                    $settings['phase'] = 'round_end';
                    $settings['current_turn_player_id'] = null;

                    // Calculate round result
                    $bidTeam = $settings['bid_team'];
                    $defendTeam = $bidTeam === 'team_a' ? 'team_b' : 'team_a';
                    $bidTeamPoints = $settings['points'][$bidTeam];
                    $bidValue = $settings['bid_value'];

                    if ($bidTeamPoints >= $bidValue) {
                        $settings['game_scores'][$bidTeam] += 1;
                        $settings['game_scores'][$defendTeam] -= 1;
                    } else {
                        $settings['game_scores'][$bidTeam] -= 1;
                        $settings['game_scores'][$defendTeam] += 1;
                    }

                    // Check for game over
                    $pointsToWin = (int) config('games.twenty_eight.points_to_win', 6);
                    if (abs($settings['game_scores']['team_a']) >= $pointsToWin ||
                        abs($settings['game_scores']['team_b']) >= $pointsToWin) {
                        $settings['phase'] = 'game_over';
                        $room->update([
                            'settings' => $settings,
                            'status' => 'finished',
                            'ended_at' => now(),
                        ]);

                        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
                    }
                } else {
                    // Set up next trick - winner leads
                    $settings['current_trick'] = [
                        'number' => $trick['number'] + 1,
                        'lead_player_id' => $winnerId,
                        'cards' => [],
                        'lead_suit' => null,
                    ];
                    $settings['current_turn_player_id'] = $winnerId;
                }
            } else {
                // Move to next player
                $playerOrder = $settings['player_order'];
                $currentIndex = array_search($currentPlayer->id, $playerOrder);
                $nextIndex = ($currentIndex + 1) % 4;
                $settings['current_turn_player_id'] = $playerOrder[$nextIndex];
            }

            $room->update(['settings' => $settings]);

            return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
        });
    }

    public function callTrump(Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        $settings = $room->settings;

        if ($settings['phase'] !== 'playing') {
            return back()->withErrors(['error' => 'Not in playing phase.']);
        }

        if ($settings['trump']['revealed']) {
            return back()->withErrors(['error' => 'Trump is already revealed.']);
        }

        if ($currentPlayer->id !== $settings['current_turn_player_id']) {
            return back()->withErrors(['error' => 'It is not your turn.']);
        }

        $trick = $settings['current_trick'];

        // Can only call trump when there's a lead suit and player can't follow
        if (empty($trick['cards'])) {
            return back()->withErrors(['error' => 'Cannot call trump when leading a trick.']);
        }

        $hand = $currentPlayer->game_data['hand'] ?? [];
        $leadSuit = $trick['lead_suit'];

        if ($this->playerHasSuit($hand, $leadSuit)) {
            return back()->withErrors(['error' => 'You have cards of the led suit. You must follow suit.']);
        }

        // Reveal trump
        $settings['trump']['revealed'] = true;

        // Return trump card to holder's hand
        $holderId = $settings['trump']['holder_id'];
        if ($holderId && $settings['trump']['card']) {
            $holder = GamePlayer::find($holderId);
            if ($holder) {
                $holderData = $holder->game_data;
                $holderData['hand'][] = $settings['trump']['card'];
                $holder->update(['game_data' => $holderData]);
            }
            $settings['trump']['card'] = null;
        }

        $room->update(['settings' => $settings]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function startNextRound(Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer?->is_host) {
            abort(403, 'Only the host can start the next round.');
        }

        $settings = $room->settings;

        if ($settings['phase'] !== 'round_end') {
            return back()->withErrors(['error' => 'Not in round end phase.']);
        }

        // Save round to history
        $settings['round_history'][] = [
            'round_number' => $settings['round_number'],
            'bid_value' => $settings['bid_value'],
            'bid_team' => $settings['bid_team'],
            'points' => $settings['points'],
            'game_scores' => $settings['game_scores'],
        ];

        // Generate new deck and deal
        $deck = $this->generateDeck();
        shuffle($deck);

        $playerOrder = $settings['player_order'];
        $players = GamePlayer::whereIn('id', $playerOrder)->get()->keyBy('id');

        foreach ($playerOrder as $index => $playerId) {
            $hand = array_slice($deck, $index * 4, 4);
            $player = $players[$playerId];
            $gameData = $player->game_data;
            $gameData['hand'] = $hand;
            $player->update(['game_data' => $gameData]);
        }

        $remainingDeck = array_slice($deck, 16);

        // Rotate dealer
        $newDealerIndex = ($settings['dealer_index'] + 1) % 4;
        $firstBidderIndex = ($newDealerIndex + 1) % 4;

        $settings['phase'] = 'bidding';
        $settings['round_number'] += 1;
        $settings['dealer_index'] = $newDealerIndex;
        $settings['remaining_deck'] = $remainingDeck;
        $settings['bidding'] = [
            'current_bidder_index' => $firstBidderIndex,
            'highest_bid' => 0,
            'highest_bidder_id' => null,
            'passed_players' => [],
            'first_round_complete' => false,
        ];
        $settings['trump'] = [
            'suit' => null,
            'card' => null,
            'revealed' => false,
            'holder_id' => null,
        ];
        $settings['current_trick'] = [
            'number' => 1,
            'lead_player_id' => null,
            'cards' => [],
            'lead_suit' => null,
        ];
        $settings['current_turn_player_id'] = $playerOrder[$firstBidderIndex];
        $settings['tricks_completed'] = [];
        $settings['points'] = ['team_a' => 0, 'team_b' => 0];
        $settings['bid_value'] = 0;
        $settings['bid_team'] = null;

        $room->update(['settings' => $settings]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * @return array<int, array{rank: string, suit: string}>
     */
    private function generateDeck(): array
    {
        $deck = [];
        foreach (self::SUITS as $suit) {
            foreach (self::RANKS as $rank) {
                $deck[] = ['rank' => $rank, 'suit' => $suit];
            }
        }

        return $deck;
    }

    private function getCardPoints(string $rank): int
    {
        return self::CARD_POINTS[$rank] ?? 0;
    }

    private function getCardStrength(string $rank): int
    {
        return self::CARD_STRENGTH[$rank] ?? 0;
    }

    /**
     * @param  array<int, array{player_id: int, card: array{rank: string, suit: string}}>  $trickCards
     */
    private function determineTrickWinner(array $trickCards, ?string $trumpSuit, bool $trumpRevealed): int
    {
        $leadSuit = $trickCards[0]['card']['suit'];
        $bestIndex = 0;
        $bestStrength = $this->getCardStrength($trickCards[0]['card']['rank']);
        $bestIsTrump = $trumpRevealed && $trickCards[0]['card']['suit'] === $trumpSuit;

        for ($i = 1; $i < count($trickCards); $i++) {
            $card = $trickCards[$i]['card'];
            $isTrump = $trumpRevealed && $card['suit'] === $trumpSuit;
            $strength = $this->getCardStrength($card['rank']);

            if ($bestIsTrump) {
                // Current best is trump
                if ($isTrump && $strength > $bestStrength) {
                    $bestIndex = $i;
                    $bestStrength = $strength;
                    $bestIsTrump = true;
                }
            } else {
                // Current best is not trump
                if ($isTrump) {
                    // Trump beats non-trump
                    $bestIndex = $i;
                    $bestStrength = $strength;
                    $bestIsTrump = true;
                } elseif ($card['suit'] === $leadSuit && $strength > $bestStrength) {
                    // Same suit, higher strength
                    $bestIndex = $i;
                    $bestStrength = $strength;
                }
            }
        }

        return $trickCards[$bestIndex]['player_id'];
    }

    /**
     * @param  array<int, array{player_id: int, card: array{rank: string, suit: string}}>  $trickCards
     */
    private function calculateTrickPoints(array $trickCards): int
    {
        $points = 0;
        foreach ($trickCards as $play) {
            $points += $this->getCardPoints($play['card']['rank']);
        }

        return $points;
    }

    /**
     * @param  array<int, array{rank: string, suit: string}>  $hand
     */
    private function playerHasSuit(array $hand, string $suit): bool
    {
        foreach ($hand as $card) {
            if ($card['suit'] === $suit) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, array{rank: string, suit: string}>  $hand
     * @param  array{rank: string, suit: string}  $targetCard
     */
    private function findCardIndex(array $hand, array $targetCard): ?int
    {
        foreach ($hand as $index => $card) {
            if ($card['rank'] === $targetCard['rank'] && $card['suit'] === $targetCard['suit']) {
                return $index;
            }
        }

        return null;
    }

    /**
     * @param  array<int, array{rank: string, suit: string}>  $hand
     * @return array<int>
     */
    private function getPlayableCardIndices(array $hand, ?string $leadSuit, ?string $trumpSuit, bool $trumpRevealed): array
    {
        if (! $leadSuit) {
            // Leading the trick - can play anything
            return array_keys($hand);
        }

        // Check if player has cards of the lead suit
        $hasLeadSuit = $this->playerHasSuit($hand, $leadSuit);

        if ($hasLeadSuit) {
            // Must follow suit
            $playable = [];
            foreach ($hand as $index => $card) {
                if ($card['suit'] === $leadSuit) {
                    $playable[] = $index;
                }
            }

            return $playable;
        }

        // No lead suit - can play any card
        return array_keys($hand);
    }

    private function buildGameState(GameRoom $room, ?GamePlayer $currentPlayer): ?array
    {
        if (! $room->isPlaying() && ! $room->isFinished()) {
            return null;
        }

        $settings = $room->settings ?? [];
        $playerOrder = $settings['player_order'] ?? [];
        $allPlayers = $room->connectedPlayers()->orderBy('created_at')->get();

        $trumpRevealed = $settings['trump']['revealed'] ?? false;
        $trumpSuit = $settings['trump']['suit'] ?? null;
        $currentTrick = $settings['current_trick'] ?? [];
        $leadSuit = $currentTrick['lead_suit'] ?? null;

        $players = $allPlayers->map(function (GamePlayer $player) use ($currentPlayer, $settings, $trumpRevealed, $trumpSuit, $leadSuit, $currentTrick) {
            $gameData = $player->game_data ?? [];
            $hand = $gameData['hand'] ?? [];
            $isCurrentPlayer = $player->id === $currentPlayer?->id;

            // Calculate playable cards for the current player
            $playableIndices = [];
            if ($isCurrentPlayer &&
                ($settings['phase'] ?? '') === 'playing' &&
                $player->id === ($settings['current_turn_player_id'] ?? null)) {
                $playableIndices = $this->getPlayableCardIndices(
                    $hand,
                    empty($currentTrick['cards']) ? null : $leadSuit,
                    $trumpSuit,
                    $trumpRevealed
                );
            }

            return [
                'id' => $player->id,
                'nickname' => $player->nickname,
                'avatar_color' => $player->avatar_color,
                'is_host' => $player->is_host,
                'is_connected' => $player->is_connected,
                'team' => $gameData['team'] ?? null,
                'seat_position' => $gameData['seat_position'] ?? 0,
                'hand' => $isCurrentPlayer ? $hand : null,
                'hand_count' => count($hand),
                'is_current_turn' => $player->id === ($settings['current_turn_player_id'] ?? null),
                'has_passed' => in_array($player->id, $settings['bidding']['passed_players'] ?? []),
                'is_bid_winner' => $player->id === ($settings['bidding']['highest_bidder_id'] ?? null),
                'playable_card_indices' => $playableIndices,
            ];
        })->values()->all();

        // Only show trump suit after reveal
        $trumpInfo = [
            'revealed' => $trumpRevealed,
            'suit' => $trumpRevealed ? $trumpSuit : null,
        ];

        // Build permissions for current player
        $phase = $settings['phase'] ?? 'bidding';
        $isMyTurn = $currentPlayer?->id === ($settings['current_turn_player_id'] ?? null);

        $currentPlayerHand = $currentPlayer ? ($currentPlayer->game_data['hand'] ?? []) : [];
        $canCallTrump = false;
        if ($isMyTurn && $phase === 'playing' && ! $trumpRevealed && ! empty($currentTrick['cards'])) {
            $canCallTrump = ! $this->playerHasSuit($currentPlayerHand, $leadSuit ?? '');
        }

        // Determine if the player needs to call trump before playing
        $mustCallTrump = false;
        if ($isMyTurn && $phase === 'playing' && ! $trumpRevealed && ! empty($currentTrick['cards'])) {
            $hasLeadSuit = $this->playerHasSuit($currentPlayerHand, $leadSuit ?? '');
            if (! $hasLeadSuit) {
                // Check if player ONLY has trump cards
                $hasTrumpOnly = true;
                foreach ($currentPlayerHand as $card) {
                    if ($card['suit'] !== $trumpSuit) {
                        $hasTrumpOnly = false;
                        break;
                    }
                }
                // If player has non-trump, non-lead cards they can play without revealing
                // If player only has trump cards, they must call trump
                $mustCallTrump = $hasTrumpOnly;
            }
        }

        $lastCompletedTrick = ! empty($settings['tricks_completed'])
            ? end($settings['tricks_completed'])
            : null;

        return [
            'phase' => $phase,
            'round_number' => $settings['round_number'] ?? 1,
            'dealer_index' => $settings['dealer_index'] ?? 0,
            'players' => $players,
            'teams' => $settings['teams'] ?? [],
            'player_order' => $playerOrder,
            'bidding' => [
                'current_bidder_id' => isset($settings['bidding']['current_bidder_index'])
                    ? ($playerOrder[$settings['bidding']['current_bidder_index']] ?? null)
                    : null,
                'highest_bid' => $settings['bidding']['highest_bid'] ?? 0,
                'highest_bidder_id' => $settings['bidding']['highest_bidder_id'] ?? null,
                'passed_players' => $settings['bidding']['passed_players'] ?? [],
            ],
            'trump' => $trumpInfo,
            'current_trick' => [
                'number' => $currentTrick['number'] ?? 1,
                'cards' => $currentTrick['cards'] ?? [],
                'lead_suit' => $currentTrick['lead_suit'] ?? null,
                'lead_player_id' => $currentTrick['lead_player_id'] ?? null,
            ],
            'last_completed_trick' => $lastCompletedTrick,
            'tricks_won' => [
                'team_a' => count(array_filter($settings['tricks_completed'] ?? [], function ($t) use ($settings) {
                    return in_array($t['winner_id'], $settings['teams']['team_a'] ?? []);
                })),
                'team_b' => count(array_filter($settings['tricks_completed'] ?? [], function ($t) use ($settings) {
                    return in_array($t['winner_id'], $settings['teams']['team_b'] ?? []);
                })),
            ],
            'points' => $settings['points'] ?? ['team_a' => 0, 'team_b' => 0],
            'game_scores' => $settings['game_scores'] ?? ['team_a' => 0, 'team_b' => 0],
            'bid_value' => $settings['bid_value'] ?? 0,
            'bid_team' => $settings['bid_team'] ?? null,
            'round_history' => $settings['round_history'] ?? [],
            'permissions' => [
                'can_bid' => $isMyTurn && $phase === 'bidding' && ! in_array($currentPlayer?->id, $settings['bidding']['passed_players'] ?? []),
                'can_pass' => $isMyTurn && $phase === 'bidding' && ! in_array($currentPlayer?->id, $settings['bidding']['passed_players'] ?? []),
                'can_select_trump' => $isMyTurn && $phase === 'trump_selection',
                'can_play_card' => $isMyTurn && $phase === 'playing' && ! $mustCallTrump,
                'can_call_trump' => $canCallTrump,
                'must_call_trump' => $mustCallTrump,
            ],
        ];
    }

    private function findCurrentPlayer(GameRoom $room): ?GamePlayer
    {
        return $room->players()
            ->where(function (Builder $query) {
                if (Auth::check()) {
                    $query->where('user_id', Auth::id());
                } else {
                    $query->where('session_id', session()->getId());
                }
            })
            ->first();
    }
}
