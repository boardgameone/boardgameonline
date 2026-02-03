<?php

namespace App\Http\Controllers;

use App\Http\Requests\RevealCardRequest;
use App\Models\Game;
use App\Models\GameCardReveal;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class TrioGameController extends Controller
{
    public function start(Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer?->is_host) {
            abort(403, 'Only the host can start the game.');
        }

        if (! $room->canStart()) {
            return back()->withErrors(['error' => 'Cannot start game. Need 3-6 players.']);
        }

        $connectedPlayers = $room->connectedPlayers;
        $playerCount = $connectedPlayers->count();

        $deck = array_merge(range(1, 12), range(1, 12), range(1, 12));
        shuffle($deck);

        $distribution = $this->distributeCards($playerCount);
        $handSize = $distribution['hand'];
        $middleSize = $distribution['middle'];

        $playerHands = [];
        $offset = 0;

        foreach ($connectedPlayers as $player) {
            $hand = array_slice($deck, $offset, $handSize);
            sort($hand);
            $playerHands[$player->id] = $hand;
            $offset += $handSize;
        }

        $middleCards = array_slice($deck, $offset, $middleSize);
        $middleGrid = [];
        foreach ($middleCards as $position => $value) {
            $middleGrid[] = [
                'position' => $position,
                'value' => $value,
                'face_up' => false,
            ];
        }

        $startingPlayer = $connectedPlayers->random();
        $turnOrder = $connectedPlayers->sortBy(function ($player) use ($startingPlayer) {
            if ($player->id === $startingPlayer->id) {
                return 0;
            }

            return $player->created_at > $startingPlayer->created_at ? 1 : 2;
        })->pluck('id')->values()->all();

        foreach ($connectedPlayers as $player) {
            $player->update([
                'game_data' => [
                    'hand' => $playerHands[$player->id],
                    'collected_trios' => [],
                ],
            ]);
        }

        $room->update([
            'status' => 'playing',
            'started_at' => now(),
            'current_hour' => 1,
            'thief_player_id' => $startingPlayer->id,
            'accomplice_player_id' => null,
            'settings' => [
                'middle_grid' => $middleGrid,
                'current_turn' => [
                    'player_id' => $startingPlayer->id,
                    'turn_number' => 1,
                    'reveals' => [],
                    'can_continue' => true,
                ],
                'turn_order' => $turnOrder,
            ],
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function revealCard(RevealCardRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if ($room->thief_player_id !== $currentPlayer->id) {
            return back()->withErrors(['error' => 'It is not your turn.']);
        }

        $settings = $room->settings;
        $currentTurn = $settings['current_turn'];

        if (! $currentTurn['can_continue']) {
            return back()->withErrors(['error' => 'Turn has ended. Please end your turn.']);
        }

        $revealType = $request->validated('reveal_type');
        $targetPlayerId = $request->validated('target_player_id');
        $middlePosition = $request->validated('middle_position');

        if (in_array($revealType, ['ask_highest', 'ask_lowest'])) {
            $targetPlayer = $room->connectedPlayers()->find($targetPlayerId);

            if (! $targetPlayer) {
                return back()->withErrors(['error' => 'Invalid target player.']);
            }

            $targetHand = $targetPlayer->game_data['hand'] ?? [];

            if (empty($targetHand)) {
                return back()->withErrors(['error' => 'Target player has no cards.']);
            }

            // Get card values already revealed from this player this turn
            $alreadyRevealedFromPlayer = collect($currentTurn['reveals'])
                ->filter(fn ($r) => $r['source'] === 'player_'.$targetPlayerId)
                ->pluck('value')
                ->all();

            // Determine the card value based on reveal type, excluding already-revealed cards
            sort($targetHand);
            $availableCards = $targetHand;

            // Remove one instance of each revealed value from available cards
            foreach ($alreadyRevealedFromPlayer as $revealedValue) {
                $key = array_search($revealedValue, $availableCards);
                if ($key !== false) {
                    unset($availableCards[$key]);
                    $availableCards = array_values($availableCards);
                }
            }

            if (empty($availableCards)) {
                return back()->withErrors(['error' => 'This player has no more unrevealed cards.']);
            }

            $cardValue = $revealType === 'ask_highest'
                ? end($availableCards)
                : reset($availableCards);

            GameCardReveal::create([
                'game_room_id' => $room->id,
                'game_player_id' => $currentPlayer->id,
                'turn_number' => $currentTurn['turn_number'],
                'reveal_type' => $revealType,
                'card_value' => $cardValue,
                'target_player_id' => $targetPlayerId,
                'middle_position' => null,
            ]);

            $currentTurn['reveals'][] = [
                'value' => $cardValue,
                'source' => 'player_'.$targetPlayerId,
                'reveal_type' => $revealType,
            ];
        } else {
            $middleGrid = $settings['middle_grid'];

            if ($middlePosition < 0 || $middlePosition >= count($middleGrid)) {
                return back()->withErrors(['error' => 'Invalid middle position.']);
            }

            $card = $middleGrid[$middlePosition];

            if ($card['face_up']) {
                return back()->withErrors(['error' => 'Card is already face up.']);
            }

            $middleGrid[$middlePosition]['face_up'] = true;
            $settings['middle_grid'] = $middleGrid;

            GameCardReveal::create([
                'game_room_id' => $room->id,
                'game_player_id' => $currentPlayer->id,
                'turn_number' => $currentTurn['turn_number'],
                'reveal_type' => $revealType,
                'card_value' => $card['value'],
                'target_player_id' => null,
                'middle_position' => $middlePosition,
            ]);

            $currentTurn['reveals'][] = [
                'value' => $card['value'],
                'source' => 'middle_'.$middlePosition,
                'reveal_type' => $revealType,
            ];
        }

        $matchResult = $this->checkForMatch($currentTurn['reveals']);

        if ($matchResult['end_turn']) {
            $currentTurn['can_continue'] = false;
        }

        $settings['current_turn'] = $currentTurn;
        $room->update(['settings' => $settings]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function claimTrio(Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if ($room->thief_player_id !== $currentPlayer->id) {
            return back()->withErrors(['error' => 'It is not your turn.']);
        }

        $settings = $room->settings;
        $currentTurn = $settings['current_turn'];
        $reveals = $currentTurn['reveals'];

        if (! $this->hasCompletedTrio($reveals)) {
            return back()->withErrors(['error' => 'No completed trio to claim.']);
        }

        $trioValue = end($reveals)['value'];
        $trioCards = array_slice($reveals, -3);

        // Use database transaction with pessimistic locking to prevent race conditions
        return DB::transaction(function () use ($game, $room, $currentPlayer, $settings, $currentTurn, $reveals, $trioValue, $trioCards) {
            // Lock and refresh the current player to prevent duplicate claims
            $currentPlayer = GamePlayer::query()->lockForUpdate()->find($currentPlayer->id);
            $gameData = $currentPlayer->game_data;

            // Check if this trio value was already claimed by this player
            $existingValues = array_map(fn ($trio) => $trio[0], $gameData['collected_trios'] ?? []);
            if (in_array($trioValue, $existingValues)) {
                return back()->withErrors(['error' => 'This trio has already been claimed.']);
            }

            // Separate middle positions and player cards
            $middlePositionsToRemove = [];
            $playerCardsToRemove = []; // [player_id => [card_values]]

            foreach ($trioCards as $card) {
                $source = $card['source'];

                if (str_starts_with($source, 'player_')) {
                    $playerId = (int) substr($source, 7);
                    if (! isset($playerCardsToRemove[$playerId])) {
                        $playerCardsToRemove[$playerId] = [];
                    }
                    $playerCardsToRemove[$playerId][] = $card['value'];
                } elseif (str_starts_with($source, 'middle_')) {
                    $position = (int) substr($source, 7);
                    $middlePositionsToRemove[] = $position;
                }
            }

            // Remove cards from player hands
            foreach ($playerCardsToRemove as $playerId => $cardValues) {
                $player = $room->connectedPlayers()->find($playerId);

                if ($player) {
                    $hand = $player->game_data['hand'] ?? [];

                    // Remove each card value once
                    foreach ($cardValues as $value) {
                        $key = array_search($value, $hand);
                        if ($key !== false) {
                            unset($hand[$key]);
                        }
                    }

                    $hand = array_values($hand);
                    $playerGameData = $player->game_data;
                    $playerGameData['hand'] = $hand;
                    $player->update(['game_data' => $playerGameData]);
                }
            }

            // Mark cards as removed at their positions (don't rearrange)
            if (! empty($middlePositionsToRemove)) {
                $middleGrid = $settings['middle_grid'];

                foreach ($middlePositionsToRemove as $position) {
                    $middleGrid[$position]['removed'] = true;
                    $middleGrid[$position]['face_up'] = false;
                    $middleGrid[$position]['value'] = null;
                }

                $settings['middle_grid'] = $middleGrid;
            }

            // Refresh current player to get the updated hand after card removal (if their cards were part of the trio)
            $currentPlayer->refresh();
            $gameData = $currentPlayer->game_data;

            // Add the trio to collected_trios
            $gameData['collected_trios'][] = [$trioValue, $trioValue, $trioValue];
            $currentPlayer->update(['game_data' => $gameData]);

            // Check for win condition first
            if (count($gameData['collected_trios']) >= 3) {
                $currentTurn['reveals'] = array_slice($reveals, 0, -3);
                $settings['current_turn'] = $currentTurn;

                $room->update([
                    'settings' => $settings,
                    'status' => 'finished',
                    'winner' => 'trio',
                    'current_hour' => 2,
                    'ended_at' => now(),
                ]);

                return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
            }

            // Game continues - advance to next player
            // Flip all middle cards face-down
            $middleGrid = $settings['middle_grid'];
            foreach ($middleGrid as $index => $card) {
                $middleGrid[$index]['face_up'] = false;
            }
            $settings['middle_grid'] = $middleGrid;

            // Calculate next player
            $turnOrder = $settings['turn_order'];
            $currentIndex = array_search($currentPlayer->id, $turnOrder);
            $nextIndex = ($currentIndex + 1) % count($turnOrder);
            $nextPlayerId = $turnOrder[$nextIndex];

            // Reset turn state for next player
            $settings['current_turn'] = [
                'player_id' => $nextPlayerId,
                'turn_number' => $currentTurn['turn_number'] + 1,
                'reveals' => [],
                'can_continue' => true,
            ];

            $room->update([
                'settings' => $settings,
                'thief_player_id' => $nextPlayerId,
            ]);

            return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
        });
    }

    public function endTurn(Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if ($room->thief_player_id !== $currentPlayer->id) {
            return back()->withErrors(['error' => 'It is not your turn.']);
        }

        $settings = $room->settings;
        $currentTurn = $settings['current_turn'];

        if (count($currentTurn['reveals']) < 2) {
            return back()->withErrors(['error' => 'You must make at least 2 reveals.']);
        }

        $middleGrid = $settings['middle_grid'];
        foreach ($middleGrid as $index => $card) {
            $middleGrid[$index]['face_up'] = false;
        }
        $settings['middle_grid'] = $middleGrid;

        $turnOrder = $settings['turn_order'];
        $currentIndex = array_search($currentPlayer->id, $turnOrder);
        $nextIndex = ($currentIndex + 1) % count($turnOrder);
        $nextPlayerId = $turnOrder[$nextIndex];

        $settings['current_turn'] = [
            'player_id' => $nextPlayerId,
            'turn_number' => $currentTurn['turn_number'] + 1,
            'reveals' => [],
            'can_continue' => true,
        ];

        $room->update([
            'settings' => $settings,
            'thief_player_id' => $nextPlayerId,
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function show(Game $game, GameRoom $room): Response
    {
        // Validate room belongs to this game
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

        return Inertia::render('Rooms/TrioGame', [
            'room' => $room,
            'currentPlayer' => $currentPlayer,
            'isHost' => $currentPlayer?->is_host ?? false,
            'gameState' => $gameState,
        ]);
    }

    private function distributeCards(int $playerCount): array
    {
        $config = [
            3 => ['hand' => 9, 'middle' => 9],
            4 => ['hand' => 7, 'middle' => 7],
            5 => ['hand' => 6, 'middle' => 6],
            6 => ['hand' => 5, 'middle' => 5],
        ];

        return $config[$playerCount] ?? ['hand' => 6, 'middle' => 6];
    }

    private function checkForMatch(array $reveals): array
    {
        if (count($reveals) < 2) {
            return ['matches' => true, 'end_turn' => false];
        }

        $lastValue = end($reveals)['value'];
        $prevValue = $reveals[count($reveals) - 2]['value'];

        if ($lastValue !== $prevValue) {
            return ['matches' => false, 'end_turn' => true];
        }

        return ['matches' => true, 'end_turn' => false];
    }

    private function hasCompletedTrio(array $reveals): bool
    {
        if (count($reveals) < 3) {
            return false;
        }

        $last3 = array_slice($reveals, -3);
        $values = array_map(fn ($r) => $r['value'], $last3);

        return count(array_unique($values)) === 1;
    }

    private function buildGameState(GameRoom $room, ?GamePlayer $currentPlayer): ?array
    {
        if (! $room->isPlaying() && ! $room->isFinished()) {
            return null;
        }

        $connectedPlayers = $room->connectedPlayers;
        $settings = $room->settings ?? [];
        $currentTurn = $settings['current_turn'] ?? [];

        $players = $connectedPlayers->map(function (GamePlayer $player) use ($currentPlayer, $room) {
            $gameData = $player->game_data ?? [];

            return [
                'id' => $player->id,
                'nickname' => $player->nickname,
                'avatar_color' => $player->avatar_color,
                'hand' => $player->id === $currentPlayer?->id ? ($gameData['hand'] ?? []) : null,
                'hand_count' => count($gameData['hand'] ?? []),
                'collected_trios' => $gameData['collected_trios'] ?? [],
                'trios_count' => count($gameData['collected_trios'] ?? []),
                'is_current_turn' => $player->id === $room->thief_player_id,
            ];
        })->values()->all();

        $middleGrid = collect($settings['middle_grid'] ?? [])->map(function ($card) {
            return [
                'position' => $card['position'],
                'value' => $card['face_up'] ? $card['value'] : null,
                'face_up' => $card['face_up'],
                'removed' => $card['removed'] ?? false,
            ];
        })->all();

        return [
            'room' => [
                'room_code' => $room->room_code,
                'status' => $room->status,
                'current_turn_player_id' => $room->thief_player_id,
                'winner' => $room->winner,
            ],
            'players' => $players,
            'middle_grid' => $middleGrid,
            'current_turn' => [
                'turn_number' => $currentTurn['turn_number'] ?? 1,
                'reveals' => $currentTurn['reveals'] ?? [],
                'can_continue' => $currentTurn['can_continue'] ?? true,
                'can_claim_trio' => $this->hasCompletedTrio($currentTurn['reveals'] ?? []),
            ],
            'permissions' => [
                'can_reveal' => $currentPlayer?->id === $room->thief_player_id && $room->status === 'playing' && ($currentTurn['can_continue'] ?? true),
                'can_claim' => $this->hasCompletedTrio($currentTurn['reveals'] ?? []),
                'can_end_turn' => $currentPlayer?->id === $room->thief_player_id && count($currentTurn['reveals'] ?? []) >= 2,
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
