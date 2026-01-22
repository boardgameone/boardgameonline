<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreateGameRoomRequest;
use App\Http\Requests\JoinGameRoomRequest;
use App\Http\Requests\PeekRequest;
use App\Http\Requests\SelectAccompliceRequest;
use App\Http\Requests\VoteRequest;
use App\Models\ChatMessage;
use App\Models\Game;
use App\Models\GamePeek;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameVote;
use App\Models\VoiceSignal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
        ]);

        $this->joinAsPlayer($room, true, $request->validated('nickname'));

        return redirect()->route('rooms.show', $room->room_code);
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

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function show(GameRoom $room): Response
    {
        $room->load([
            'game',
            'host:id,name',
            'players' => function ($query) {
                $query->orderBy('created_at');
            },
            'votes',
            'peeks',
        ]);

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

    public function start(GameRoom $room): RedirectResponse
    {
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
        ]);

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function confirmRoll(GameRoom $room): RedirectResponse
    {
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

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function peek(PeekRequest $request, GameRoom $room): RedirectResponse
    {
        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        $hour = $room->current_hour;
        if (! $room->isPlaying() || $hour < 1 || $hour > 6) {
            return back()->withErrors(['error' => 'Cannot peek at this time.']);
        }

        // Check if the current player woke up at this hour
        if ($currentPlayer->die_value !== $hour) {
            return back()->withErrors(['error' => 'You did not wake up at this hour.']);
        }

        // Check if player is alone
        if (! $room->playerWokeUpAlone($hour)) {
            return back()->withErrors(['error' => 'You are not alone at this hour.']);
        }

        // Check if already completed this hour
        if ($currentPlayer->hasCompletedHour($hour)) {
            return back()->withErrors(['error' => 'You have already taken action this hour.']);
        }

        $targetPlayerId = $request->validated('target_player_id');
        $targetPlayer = $room->connectedPlayers()->find($targetPlayerId);

        if (! $targetPlayer || $targetPlayer->id === $currentPlayer->id) {
            return back()->withErrors(['error' => 'Invalid target player.']);
        }

        // Record the peek
        GamePeek::create([
            'game_room_id' => $room->id,
            'peeker_id' => $currentPlayer->id,
            'peeked_at_id' => $targetPlayer->id,
            'hour' => $hour,
            'saw_thief' => $targetPlayer->is_thief,
        ]);

        // Store the peeked info in the player's game data
        $currentPlayer->recordPeek($targetPlayer->id, $targetPlayer->die_value);

        // If peeked at thief, mark that cheese is stolen
        if ($targetPlayer->is_thief) {
            $currentPlayer->update(['has_stolen_cheese' => true]);
        }

        // Mark hour as completed
        $currentPlayer->completeHour($hour);

        // Check if we should advance
        $room->refresh();
        if ($room->currentHourComplete()) {
            $this->advanceToNextPhase($room);
        }

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function skipPeek(GameRoom $room): RedirectResponse
    {
        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        $hour = $room->current_hour;
        if (! $room->isPlaying() || $hour < 1 || $hour > 6) {
            return back()->withErrors(['error' => 'Cannot skip peek at this time.']);
        }

        // Check if the current player woke up at this hour
        if ($currentPlayer->die_value !== $hour) {
            return back()->withErrors(['error' => 'You did not wake up at this hour.']);
        }

        // Check if player is alone
        if (! $room->playerWokeUpAlone($hour)) {
            return back()->withErrors(['error' => 'You are not alone at this hour.']);
        }

        // Mark hour as completed without peeking
        $currentPlayer->completeHour($hour);

        // Check if we should advance
        $room->refresh();
        if ($room->currentHourComplete()) {
            $this->advanceToNextPhase($room);
        }

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function selectAccomplice(SelectAccompliceRequest $request, GameRoom $room): RedirectResponse
    {
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

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function vote(VoteRequest $request, GameRoom $room): RedirectResponse
    {
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

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function leave(GameRoom $room): RedirectResponse
    {
        $player = $this->findCurrentPlayer($room);

        if ($player) {
            $player->update(['is_connected' => false]);

            if ($player->is_host && $room->isWaiting()) {
                $newHost = $room->connectedPlayers()->where('id', '!=', $player->id)->first();
                if ($newHost) {
                    $newHost->update(['is_host' => true]);
                    $room->update(['host_user_id' => $newHost->user_id]);
                }
            }
        }

        return redirect()->route('games.show', $room->game->slug);
    }

    /**
     * Join a room directly via link (for guests who need to provide nickname).
     */
    public function joinDirect(JoinGameRoomRequest $request, GameRoom $room): RedirectResponse
    {
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

        return redirect()->route('rooms.show', $room->room_code);
    }

    /**
     * Send a chat message in the room.
     */
    public function sendMessage(Request $request, GameRoom $room): JsonResponse
    {
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
    public function getMessages(Request $request, GameRoom $room): JsonResponse
    {
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
     */
    private function advanceToNextPhase(GameRoom $room): void
    {
        $currentHour = $room->current_hour;

        if ($currentHour === 0) {
            // Rolling phase complete -> move to hour 1
            $room->update(['current_hour' => 1]);
            $room->refresh();
            // Auto-advance through empty night hours
            $this->autoAdvanceNightHours($room);
        } elseif ($currentHour >= 1 && $currentHour <= 5) {
            // Night hour complete -> move to next hour
            $room->update(['current_hour' => $currentHour + 1]);
            $room->refresh();
            // Auto-advance through empty night hours
            $this->autoAdvanceNightHours($room);
        } elseif ($currentHour === 6) {
            // Last night hour complete -> move to accomplice selection
            $room->update(['current_hour' => 7]);
        } elseif ($currentHour === 7) {
            // Accomplice selected -> move to voting
            $room->update(['current_hour' => 8]);
        }
        // Hour 8 (voting) -> 9 (results) is handled in vote() when all votes are in
    }

    /**
     * Auto-advance through night hours where no action is needed.
     */
    private function autoAdvanceNightHours(GameRoom $room): void
    {
        while ($room->current_hour >= 1 && $room->current_hour <= 6) {
            if ($room->currentHourComplete()) {
                if ($room->current_hour === 6) {
                    // Move to accomplice selection
                    $room->update(['current_hour' => 7]);

                    return;
                }
                $room->update(['current_hour' => $room->current_hour + 1]);
                $room->refresh();
            } else {
                // Someone needs to take action
                return;
            }
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

        // Build players array with visibility rules
        $players = $connectedPlayers->map(function (GamePlayer $player) use ($currentPlayer, $isThief, $isAccomplice, $isGameOver) {
            $isSelf = $currentPlayer && $player->id === $currentPlayer->id;
            $peekedPlayers = $currentPlayer?->getPeekedPlayers() ?? [];

            return [
                'id' => $player->id,
                'nickname' => $player->nickname,
                'avatar_color' => $player->avatar_color,
                'is_host' => $player->is_host,
                'is_connected' => $player->is_connected,
                'turn_order' => $player->turn_order,
                // Die value: visible to self, or if peeked, or game over
                'die_value' => ($isSelf || isset($peekedPlayers[$player->id]) || $isGameOver) ? $player->die_value : null,
                // Thief status: visible to thief (self), or game over
                'is_thief' => ($isGameOver || ($isThief && $player->is_thief)) ? $player->is_thief : null,
                // Accomplice status: visible to thief, accomplice, or game over
                'is_accomplice' => ($isGameOver || $isThief || $isAccomplice) ? $player->is_accomplice : null,
                // Has confirmed roll
                'has_confirmed_roll' => $player->hasConfirmedRoll(),
                // Has voted
                'has_voted' => $player->hasVoted(),
                // Has stolen cheese (peeked at thief) - always public
                'has_stolen_cheese' => $player->has_stolen_cheese,
            ];
        })->values()->all();

        // Build awake players for current hour
        $awakePlayers = [];
        if ($room->current_hour >= 1 && $room->current_hour <= 6) {
            $awakePlayers = $room->playersAtHour($room->current_hour)->pluck('id')->all();
        }

        // Determine if current player can peek
        $canPeek = false;
        $canSkipPeek = false;
        if ($currentPlayer && $room->current_hour >= 1 && $room->current_hour <= 6) {
            $canPeek = $currentPlayer->die_value === $room->current_hour
                && $room->playerWokeUpAlone($room->current_hour)
                && ! $currentPlayer->hasCompletedHour($room->current_hour);
            $canSkipPeek = $canPeek;
        }

        // Determine if current player can select accomplice
        $canSelectAccomplice = $isThief && $room->current_hour === 7 && ! $room->accomplice_player_id;

        // Determine if current player can vote
        $canVote = $room->current_hour === 8 && $currentPlayer && ! $currentPlayer->hasVoted();

        // Get vote counts (only visible when game is over)
        $voteCounts = [];
        if ($isGameOver) {
            foreach ($room->votes as $vote) {
                $votedForId = $vote->voted_for_id;
                $voteCounts[$votedForId] = ($voteCounts[$votedForId] ?? 0) + 1;
            }
        }

        return [
            'current_hour' => $room->current_hour,
            'players' => $players,
            'awake_player_ids' => $awakePlayers,
            'can_peek' => $canPeek,
            'can_skip_peek' => $canSkipPeek,
            'can_select_accomplice' => $canSelectAccomplice,
            'can_vote' => $canVote,
            'cheese_stolen' => $room->isCheeseStolen(),
            'winner' => $room->winner,
            'thief_player_id' => $isGameOver ? $room->thief_player_id : null,
            'accomplice_player_id' => ($isGameOver || $isThief || $isAccomplice) ? $room->accomplice_player_id : null,
            'vote_counts' => $voteCounts,
            'total_votes_cast' => $room->votes->count(),
            'total_players' => $connectedPlayers->count(),
            'current_player_id' => $currentPlayer?->id,
            'is_thief' => $isThief,
            'is_accomplice' => $isAccomplice,
        ];
    }

    /**
     * Send a WebRTC signal to another player.
     */
    public function sendSignal(Request $request, GameRoom $room): JsonResponse
    {
        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $validated = $request->validate([
            'to_player_id' => ['required', 'integer', 'exists:game_players,id'],
            'type' => ['required', 'string', 'in:offer,answer,ice-candidate'],
            'payload' => ['required', 'array'],
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
    public function getSignals(Request $request, GameRoom $room): JsonResponse
    {
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
    public function toggleMute(GameRoom $room): JsonResponse
    {
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
     * Get voice status of all players (mute state).
     */
    public function getVoiceStatus(GameRoom $room): JsonResponse
    {
        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            return response()->json(['error' => 'You are not a player in this room.'], 403);
        }

        $players = $room->connectedPlayers()
            ->get(['id', 'nickname', 'avatar_color', 'is_muted'])
            ->map(fn (GamePlayer $player) => [
                'id' => $player->id,
                'nickname' => $player->nickname,
                'avatar_color' => $player->avatar_color,
                'is_muted' => $player->is_muted,
            ]);

        return response()->json([
            'players' => $players,
            'current_player_id' => $currentPlayer->id,
        ]);
    }
}
