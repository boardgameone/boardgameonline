<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreateGameRoomRequest;
use App\Http\Requests\JoinGameRoomRequest;
use App\Http\Requests\PeekRequest;
use App\Http\Requests\SelectAccompliceRequest;
use App\Http\Requests\VoteRequest;
use App\Models\ChatMessage;
use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameVote;
use App\Models\VoiceSignal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class GameRoomController extends Controller
{
    public function store(CreateGameRoomRequest $request): RedirectResponse
    {
        $game = Game::findOrFail($request->validated('game_id'));

        $room = GameRoom::create([
            'game_id' => $game->id,
            'host_user_id' => Auth::id(), // null for guests
            'name' => $request->validated('name'),
            'is_public' => $request->validated('is_public') ?? true,
        ]);

        $this->joinAsPlayer($room, true, $request->validated('nickname'));

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function showJoin(): Response
    {
        return Inertia::render('Rooms/Join');
    }

    public function join(JoinGameRoomRequest $request): RedirectResponse
    {
        $room = GameRoom::where('room_code', strtoupper($request->validated('room_code')))->first();

        if (! $room) {
            return back()->withErrors(['room_code' => 'Room not found.']);
        }

        if (! $room->isWaiting()) {
            return back()->withErrors(['room_code' => 'This room is no longer accepting players.']);
        }

        if ($room->isFull()) {
            return back()->withErrors(['room_code' => 'This room is full.']);
        }

        $existingPlayer = $this->findCurrentPlayer($room);

        if (! $existingPlayer) {
            $this->joinAsPlayer($room, false, $request->validated('nickname'));
        } else {
            $existingPlayer->update(['is_connected' => true]);
        }

        return redirect()->route('rooms.show', [$room->game->slug, $room->room_code]);
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
            'votes',
        ]);

        // Find or auto-join current player FIRST (for all games)
        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer && $room->isWaiting() && ! $room->isFull()) {
            // Auto-join authenticated users who visit the room directly
            // Guests must explicitly join with a nickname
            if (Auth::check()) {
                $this->joinAsPlayer($room, false, null);
                $currentPlayer = $this->findCurrentPlayer($room);
                $room->load('players');
            }
        }

        // Route to Trio game controller if this is a Trio game
        if ($room->game?->slug === 'trio') {
            return app(TrioGameController::class)->show($game, $room);
        }

        // Route to Twenty-Eight game controller
        if ($room->game?->slug === 'twenty-eight') {
            return app(TwentyEightGameController::class)->show($game, $room);
        }

        // Route to CubeTac game controller
        if ($room->game?->slug === 'cubetac') {
            return app(CubeTacGameController::class)->show($game, $room);
        }

        // Settle expired night hours (driven by frontend polling).
        // Each request that lands on this page advances the clock if the timer
        // for the current hour has run out.
        if ($room->isPlaying() && $room->current_hour >= 1 && $room->current_hour <= 6) {
            $this->settleNight($room);
            $room->refresh();
            $room->load(['players', 'votes']);
        }

        // Build game state with visibility rules
        $gameState = $this->buildGameState($room, $currentPlayer);

        // Add is_full to room data
        $roomData = $room->toArray();
        $roomData['is_full'] = $room->isFull();

        return Inertia::render('Rooms/Show', [
            'room' => $roomData,
            'currentPlayer' => $currentPlayer,
            'isHost' => $currentPlayer?->is_host ?? false,
            'gameState' => $gameState,
        ]);
    }

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
            return back()->withErrors(['error' => 'Cannot start game. Need at least '.$room->game->min_players.' players.']);
        }

        $connectedPlayers = $room->connectedPlayers;

        // Randomly assign thief
        $thiefPlayer = $connectedPlayers->random();
        $thiefPlayer->update(['is_thief' => true]);

        // Roll dice for all players (1-6)
        foreach ($connectedPlayers as $index => $player) {
            $player->update([
                'die_value' => rand(1, 6),
                'turn_order' => $index,
                'game_data' => [],
            ]);
        }

        $room->update([
            'status' => 'playing',
            'started_at' => now(),
            'current_hour' => 0, // Rolling phase
            'thief_player_id' => $thiefPlayer->id,
            'cheese_stolen_at_hour' => null,
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function confirmRoll(Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if (! $room->isPlaying() || $room->current_hour !== 0) {
            return back()->withErrors(['error' => 'Cannot confirm roll at this time.']);
        }

        $currentPlayer->confirmRoll();

        // Reload to check if all players confirmed
        $room->load('players');
        if ($room->allPlayersConfirmedRoll()) {
            $this->advanceToNextPhase($room);
        }

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Thief manually steals the cheese during their wake hour.
     * If they don't tap, the cheese is auto-stolen when their hour expires
     * (handled in settleNight()).
     */
    public function stealCheese(Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if (! $currentPlayer->is_thief) {
            return back()->withErrors(['error' => 'Only the thief can steal the cheese.']);
        }

        $hour = $room->current_hour;
        if (! $room->isPlaying() || $hour < 1 || $hour > 6) {
            return back()->withErrors(['error' => 'Cannot steal at this time.']);
        }

        if ($currentPlayer->die_value !== $hour) {
            return back()->withErrors(['error' => 'You can only steal during your wake hour.']);
        }

        if (! is_null($room->cheese_stolen_at_hour)) {
            return back()->withErrors(['error' => 'The cheese has already been stolen.']);
        }

        $room->update(['cheese_stolen_at_hour' => $hour]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * A mouse who is awake alone at the current hour can peek at one
     * other mouse to learn what hour they wake up.
     */
    public function peek(PeekRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        $hour = $room->current_hour;
        if (! $room->isPlaying() || $hour < 1 || $hour > 6) {
            return back()->withErrors(['error' => 'You can only peek during the night.']);
        }

        if ($currentPlayer->die_value !== $hour) {
            return back()->withErrors(['error' => 'You did not wake up at this hour.']);
        }

        if (! $room->playerWokeUpAlone($hour)) {
            return back()->withErrors(['error' => 'You can only peek when alone.']);
        }

        if ($currentPlayer->hasPeekedAtHour($hour)) {
            return back()->withErrors(['error' => 'You have already peeked this hour.']);
        }

        $targetPlayerId = (int) $request->validated('target_player_id');
        $targetPlayer = $room->connectedPlayers()->find($targetPlayerId);

        if (! $targetPlayer || $targetPlayer->id === $currentPlayer->id) {
            return back()->withErrors(['error' => 'Invalid target mouse.']);
        }

        $currentPlayer->recordPeek($targetPlayer->id, (int) $targetPlayer->die_value, $hour);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function selectAccomplice(SelectAccompliceRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if (! $currentPlayer->is_thief) {
            return back()->withErrors(['error' => 'Only the thief can select an accomplice.']);
        }

        if ($room->current_hour !== 7) {
            return back()->withErrors(['error' => 'Cannot select accomplice at this time.']);
        }

        $accomplicePlayerId = $request->validated('accomplice_player_id');
        $accomplicePlayer = $room->connectedPlayers()->find($accomplicePlayerId);

        if (! $accomplicePlayer || $accomplicePlayer->id === $currentPlayer->id) {
            return back()->withErrors(['error' => 'Invalid accomplice selection.']);
        }

        // Update the accomplice
        $accomplicePlayer->update(['is_accomplice' => true]);
        $room->update(['accomplice_player_id' => $accomplicePlayer->id]);

        // Advance to voting
        $this->advanceToNextPhase($room);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function vote(VoteRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if ($room->current_hour !== 8) {
            return back()->withErrors(['error' => 'Cannot vote at this time.']);
        }

        if ($currentPlayer->hasVoted()) {
            return back()->withErrors(['error' => 'You have already voted.']);
        }

        $votedForPlayerId = $request->validated('voted_for_player_id');
        $votedForPlayer = $room->connectedPlayers()->find($votedForPlayerId);

        if (! $votedForPlayer || $votedForPlayer->id === $currentPlayer->id) {
            return back()->withErrors(['error' => 'Invalid vote.']);
        }

        // Record the vote
        GameVote::create([
            'game_room_id' => $room->id,
            'voter_id' => $currentPlayer->id,
            'voted_for_id' => $votedForPlayer->id,
        ]);

        $currentPlayer->markVoted();

        // Check if all votes are in
        $room->load(['players', 'votes']);
        if ($room->allVotesCast()) {
            // Calculate results and finish game
            $results = $room->calculateResults();
            $room->update([
                'current_hour' => 9, // Results phase
                'winner' => $results['winner'],
                'status' => 'finished',
                'ended_at' => now(),
            ]);
        }

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    public function leave(Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $player = $this->findCurrentPlayer($room);

        if ($player) {
            DB::transaction(function () use ($room, $player) {
                $player->update(['is_connected' => false]);

                if ($player->is_host && $room->isWaiting()) {
                    $newHost = $room->connectedPlayers()->where('id', '!=', $player->id)->first();
                    if ($newHost) {
                        $newHost->update(['is_host' => true]);
                        $room->update(['host_user_id' => $newHost->user_id]);
                    }
                }

                if ($room->connectedPlayers()->doesntExist()) {
                    $room->delete();
                }
            });
        }

        return redirect()->route('games.show', $game->slug);
    }

    /**
     * Kick a player from the lobby. Host-only, waiting phase only.
     */
    public function kick(Request $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $validated = $request->validate([
            'player_id' => ['required', 'integer'],
        ]);

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer?->is_host) {
            abort(403, 'Only the host can kick players.');
        }

        if (! $room->isWaiting()) {
            return back()->withErrors(['error' => 'Can only kick during the lobby.']);
        }

        $target = $room->players()->find($validated['player_id']);

        if (! $target) {
            abort(404, 'Player not found in this room.');
        }

        if ($target->id === $currentPlayer->id) {
            return back()->withErrors(['error' => 'You cannot kick yourself. Use leave instead.']);
        }

        $target->update(['is_connected' => false]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Reset a finished game to allow playing again with the same players.
     */
    public function reset(Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        // Authorization: Only host can reset
        if (! $currentPlayer?->is_host) {
            abort(403, 'Only the host can reset the game.');
        }

        // Only allow reset from finished games
        if (! $room->isFinished()) {
            return back()->withErrors(['error' => 'Can only reset finished games.']);
        }

        // Reset room state
        $room->update([
            'status' => 'waiting',
            'current_hour' => 0,
            'thief_player_id' => null,
            'accomplice_player_id' => null,
            'cheese_stolen_at_hour' => null,
            'hour_started_at' => null,
            'winner' => null,
            'settings' => null,
            'started_at' => null,
            'ended_at' => null,
        ]);

        // Reset all players
        foreach ($room->players as $player) {
            $player->update([
                'is_thief' => false,
                'is_accomplice' => false,
                'die_value' => null,
                'turn_order' => null,
                'game_data' => [],
            ]);
        }

        // Clear game-specific data
        $room->votes()->delete();
        $room->actions()->delete();
        $room->cardReveals()->delete();

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Join a room directly via link (for guests who need to provide nickname).
     */
    public function joinDirect(JoinGameRoomRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if (! $room->isWaiting()) {
            return back()->withErrors(['nickname' => 'This room is no longer accepting players.']);
        }

        if ($room->isFull()) {
            return back()->withErrors(['nickname' => 'This room is full.']);
        }

        $existingPlayer = $this->findCurrentPlayer($room);

        if (! $existingPlayer) {
            $this->joinAsPlayer($room, false, $request->validated('nickname'));
        } else {
            $existingPlayer->update(['is_connected' => true]);
        }

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Send a chat message in the room.
     */
    public function sendMessage(Request $request, Game $game, GameRoom $room): JsonResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:500'],
        ]);

        $chatMessage = ChatMessage::create([
            'game_room_id' => $room->id,
            'game_player_id' => $currentPlayer->id,
            'message' => $validated['message'],
        ]);

        return response()->json([
            'success' => true,
            'message' => [
                'id' => $chatMessage->id,
                'message' => $chatMessage->message,
                'created_at' => $chatMessage->created_at->toISOString(),
                'player' => [
                    'id' => $currentPlayer->id,
                    'nickname' => $currentPlayer->nickname,
                    'avatar_color' => $currentPlayer->avatar_color,
                ],
            ],
        ]);
    }

    /**
     * Get chat messages for the room.
     */
    public function getMessages(Request $request, Game $game, GameRoom $room): JsonResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $afterId = $request->query('after_id', 0);

        $messages = $room->chatMessages()
            ->with('player:id,nickname,avatar_color')
            ->where('id', '>', $afterId)
            ->orderBy('created_at', 'asc')
            ->limit(100)
            ->get()
            ->map(fn (ChatMessage $msg) => [
                'id' => $msg->id,
                'message' => $msg->message,
                'created_at' => $msg->created_at->toISOString(),
                'player' => [
                    'id' => $msg->player->id,
                    'nickname' => $msg->player->nickname,
                    'avatar_color' => $msg->player->avatar_color,
                ],
            ]);

        return response()->json([
            'messages' => $messages,
        ]);
    }

    /**
     * Find the current player in a room by user_id (if authenticated) or session_id (if guest).
     */
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

    private function joinAsPlayer(GameRoom $room, bool $isHost, ?string $nickname = null): GamePlayer
    {
        $user = Auth::user();
        $colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

        return GamePlayer::create([
            'game_room_id' => $room->id,
            'user_id' => $user?->id, // null for guests
            'session_id' => session()->getId(),
            'nickname' => $nickname ?? $user?->name ?? 'Guest',
            'avatar_color' => $colors[array_rand($colors)],
            'is_host' => $isHost,
            'is_connected' => true,
        ]);
    }

    /**
     * Advance the game to the next phase.
     * Used for non-night transitions (rolling -> hour 1, accomplice -> voting).
     * Night-hour transitions are handled by settleNight().
     */
    private function advanceToNextPhase(GameRoom $room): void
    {
        $currentHour = $room->current_hour;

        if ($currentHour === 0) {
            $room->update([
                'current_hour' => 1,
                'hour_started_at' => now(),
            ]);
        } elseif ($currentHour === 7) {
            $room->update(['current_hour' => 8]);
        }
        // Hour 8 (voting) -> 9 (results) is handled in vote() when all votes are in.
        // Night hour transitions (1..6 -> 7) are handled by settleNight().
    }

    /**
     * Tick the night clock forward when the current hour's timer has expired.
     *
     * Each night hour runs for the full timer duration regardless of whether
     * any mice are awake — like a narrator counting through the night. When
     * the timer expires, this method:
     *   1. Auto-steals the cheese if it's the thief's hour and they didn't tap.
     *   2. Advances to the next hour (or to the accomplice phase after hour 6).
     *
     * The loop guards against an idle tab where multiple hours may have
     * elapsed since the last poll.
     */
    private function settleNight(GameRoom $room): void
    {
        while ($room->current_hour >= 1 && $room->current_hour <= 6 && $room->isHourTimerExpired()) {
            $expiredHour = $room->current_hour;
            $duration = $room->getHourTimerDuration();
            $nextStartedAt = $room->hour_started_at?->copy()->addSeconds($duration) ?? now();

            // Auto-steal: if the cheese was never grabbed and this was the thief's hour.
            if (is_null($room->cheese_stolen_at_hour) && $room->thiefDieValue() === $expiredHour) {
                $room->update(['cheese_stolen_at_hour' => $expiredHour]);
            }

            if ($expiredHour === 6) {
                $room->update([
                    'current_hour' => 7,
                    'hour_started_at' => null,
                ]);

                return;
            }

            $room->update([
                'current_hour' => $expiredHour + 1,
                // Step the clock forward by the full duration so that an idle tab
                // whose poll lands several hours late will chain through them all.
                'hour_started_at' => $nextStartedAt,
            ]);
            $room->refresh();
        }
    }

    /**
     * Build the game state with proper visibility rules.
     *
     * @return array<string, mixed>|null
     */
    private function buildGameState(GameRoom $room, ?GamePlayer $currentPlayer): ?array
    {
        if (! $room->isPlaying() && ! $room->isFinished()) {
            return null;
        }

        $connectedPlayers = $room->connectedPlayers;
        $isThief = $currentPlayer?->is_thief ?? false;
        $isAccomplice = $currentPlayer?->is_accomplice ?? false;
        $isGameOver = $room->isFinished();
        $currentHour = $room->current_hour;

        $peekedPlayers = $currentPlayer?->getPeekedPlayers() ?? [];

        // Build players array with visibility rules
        $players = $connectedPlayers->map(function (GamePlayer $player) use ($currentPlayer, $isThief, $isAccomplice, $isGameOver, $peekedPlayers) {
            $isSelf = $currentPlayer && $player->id === $currentPlayer->id;

            // Die value: visible to self, anyone the player has peeked at, or at game end.
            $dieValue = null;
            if ($isSelf || $isGameOver) {
                $dieValue = $player->die_value;
            } elseif (isset($peekedPlayers[$player->id])) {
                $dieValue = (int) $peekedPlayers[$player->id];
            }

            // Thief status: revealed to the thief themselves AND to a selected accomplice
            // (after they're picked) AND at game end.
            $thiefRevealed = $isGameOver
                || ($isThief && $player->is_thief)
                || ($isAccomplice && $player->is_thief);

            return [
                'id' => $player->id,
                'nickname' => $player->nickname,
                'avatar_color' => $player->avatar_color,
                'is_host' => $player->is_host,
                'is_connected' => $player->is_connected,
                'turn_order' => $player->turn_order,
                'die_value' => $dieValue,
                'is_thief' => $thiefRevealed ? $player->is_thief : null,
                // Accomplice status: visible to thief, accomplice, or at game end.
                'is_accomplice' => ($isGameOver || $isThief || $isAccomplice) ? $player->is_accomplice : null,
                'has_confirmed_roll' => $player->hasConfirmedRoll(),
                'has_voted' => $player->hasVoted(),
            ];
        })->values()->all();

        // Mice awake at the current hour (their die value matches).
        $awakePlayers = [];
        if ($currentHour >= 1 && $currentHour <= 6) {
            $awakePlayers = $room->playersAtHour($currentHour)->pluck('id')->all();
        }

        // Thief's manual-steal button: only during their wake hour, before the cheese is stolen.
        $canStealCheese = $isThief
            && $currentPlayer
            && $currentHour >= 1
            && $currentHour <= 6
            && $currentPlayer->die_value === $currentHour
            && is_null($room->cheese_stolen_at_hour);

        // Curtains opened? Only when the player's hour is now.
        $isCurrentPlayerAwakeNow = $currentPlayer
            && $currentHour >= 1
            && $currentHour <= 6
            && $currentPlayer->die_value === $currentHour;

        // What the current player would see if their curtains are open.
        $cheeseVisibleToSelf = 'hidden';
        if ($isGameOver) {
            $cheeseVisibleToSelf = is_null($room->cheese_stolen_at_hour) ? 'present' : 'gone';
        } elseif ($isCurrentPlayerAwakeNow) {
            $cheeseVisibleToSelf = is_null($room->cheese_stolen_at_hour) ? 'present' : 'gone';
        }

        // Whether the *fact* of theft is known to the current player. They only
        // "know" once their own wake hour has passed (or has arrived now).
        $cheeseStolenKnown = false;
        if ($isGameOver) {
            $cheeseStolenKnown = $room->isCheeseStolen();
        } elseif ($currentPlayer && ! is_null($currentPlayer->die_value) && ! is_null($room->cheese_stolen_at_hour)) {
            $cheeseStolenKnown = $currentHour >= $currentPlayer->die_value
                && $room->cheese_stolen_at_hour <= $currentPlayer->die_value;
        }

        // A mouse can peek at one other mouse if they're awake alone tonight,
        // and they haven't already peeked this hour.
        $canPeek = $currentPlayer
            && $currentHour >= 1
            && $currentHour <= 6
            && $currentPlayer->die_value === $currentHour
            && $room->playerWokeUpAlone($currentHour)
            && ! $currentPlayer->hasPeekedAtHour($currentHour);

        $canSelectAccomplice = $isThief && $currentHour === 7 && ! $room->accomplice_player_id;
        $canVote = $currentHour === 8 && $currentPlayer && ! $currentPlayer->hasVoted();

        $voteCounts = [];
        if ($isGameOver) {
            foreach ($room->votes as $vote) {
                $votedForId = $vote->voted_for_id;
                $voteCounts[$votedForId] = ($voteCounts[$votedForId] ?? 0) + 1;
            }
        }

        return [
            'current_hour' => $currentHour,
            'players' => $players,
            'awake_player_ids' => $awakePlayers,
            'can_steal_cheese' => $canStealCheese,
            'can_peek' => $canPeek,
            'cheese_visible_to_self' => $cheeseVisibleToSelf,
            'cheese_stolen' => $cheeseStolenKnown,
            'cheese_stolen_at_hour' => $isGameOver ? $room->cheese_stolen_at_hour : null,
            'can_select_accomplice' => $canSelectAccomplice,
            'can_vote' => $canVote,
            'winner' => $room->winner,
            // Thief identity is revealed to the thief themselves (always),
            // to a selected accomplice once chosen, and to everyone at game end.
            'thief_player_id' => ($isGameOver || $isThief || $isAccomplice)
                ? $room->thief_player_id
                : null,
            'accomplice_player_id' => ($isGameOver || $isThief || $isAccomplice) ? $room->accomplice_player_id : null,
            'vote_counts' => $voteCounts,
            'total_votes_cast' => $room->votes->count(),
            'total_players' => $connectedPlayers->count(),
            'current_player_id' => $currentPlayer?->id,
            'is_thief' => $isThief,
            'is_accomplice' => $isAccomplice,
            'isHost' => $currentPlayer?->is_host ?? false,
            'hour_started_at' => $room->hour_started_at?->toISOString(),
            'hour_timer_duration' => $room->getHourTimerDuration(),
        ];
    }

    /**
     * Send a WebRTC signal to another player.
     */
    public function sendSignal(Request $request, Game $game, GameRoom $room): JsonResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $validated = $request->validate([
            'to_player_id' => ['required', 'integer', 'exists:game_players,id'],
            'type' => ['required', 'string', 'in:offer,answer,ice-candidate'],
            'payload' => ['required', 'array', 'max:50'],
        ]);

        // Verify target player is in the same room
        $targetPlayer = $room->connectedPlayers()->find($validated['to_player_id']);
        if (! $targetPlayer) {
            return response()->json(['error' => 'Target player not found in room.'], 404);
        }

        VoiceSignal::create([
            'game_room_id' => $room->id,
            'from_player_id' => $currentPlayer->id,
            'to_player_id' => $validated['to_player_id'],
            'type' => $validated['type'],
            'payload' => $validated['payload'],
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Get pending WebRTC signals for the current player.
     */
    public function getSignals(Request $request, Game $game, GameRoom $room): JsonResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $signals = VoiceSignal::where('game_room_id', $room->id)
            ->where('to_player_id', $currentPlayer->id)
            ->where('processed', false)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn (VoiceSignal $signal) => [
                'id' => $signal->id,
                'from_player_id' => $signal->from_player_id,
                'type' => $signal->type,
                'payload' => $signal->payload,
            ]);

        // Mark as processed
        VoiceSignal::where('game_room_id', $room->id)
            ->where('to_player_id', $currentPlayer->id)
            ->where('processed', false)
            ->update(['processed' => true]);

        return response()->json(['signals' => $signals]);
    }

    /**
     * Toggle mute status for the current player.
     */
    public function toggleMute(Game $game, GameRoom $room): JsonResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $currentPlayer->update(['is_muted' => ! $currentPlayer->is_muted]);

        return response()->json([
            'success' => true,
            'is_muted' => $currentPlayer->is_muted,
        ]);
    }

    /**
     * Get voice status of all players (mute state and video state).
     */
    public function getVoiceStatus(Game $game, GameRoom $room): JsonResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $players = $room->connectedPlayers()
            ->get(['id', 'nickname', 'avatar_color', 'is_muted', 'is_video_enabled'])
            ->map(fn (GamePlayer $player) => [
                'id' => $player->id,
                'nickname' => $player->nickname,
                'avatar_color' => $player->avatar_color,
                'is_muted' => $player->is_muted,
                'is_video_enabled' => $player->is_video_enabled,
            ]);

        return response()->json([
            'players' => $players,
            'current_player_id' => $currentPlayer->id,
        ]);
    }

    /**
     * Toggle video status for the current player.
     */
    public function toggleVideo(Game $game, GameRoom $room): JsonResponse
    {
        // Validate room belongs to this game
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $currentPlayer->update(['is_video_enabled' => ! $currentPlayer->is_video_enabled]);

        return response()->json([
            'success' => true,
            'is_video_enabled' => $currentPlayer->is_video_enabled,
        ]);
    }
}
