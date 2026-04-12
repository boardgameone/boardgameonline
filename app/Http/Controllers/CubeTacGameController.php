<?php

namespace App\Http\Controllers;

use App\Http\Requests\MarkStickerRequest;
use App\Http\Requests\RotateCubeRequest;
use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Services\RubikCube;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CubeTacGameController extends Controller
{
    /**
     * Move-limit scaling factor. Each player gets roughly this many turns
     * before the game hits the soft draw cap, so 2-player games cap at 60
     * (preserving the pre-refactor limit), and 6-player games cap at 180.
     */
    private const MOVES_PER_PLAYER = 30;

    private const HISTORY_CAP = 20;

    /**
     * Per-slot avatar color palette. Joiner N gets $colors[N]. Must be kept
     * in sync with the 3D glyph palette in resources/js/Pages/Rooms/CubeTac/CubeScene.tsx.
     *
     * @var list<string>
     */
    private const SLOT_COLORS = ['#ff4d2e', '#3a90ff', '#16a34a', '#a855f7', '#f59e0b', '#c2813a'];

    /**
     * Render the online match room.
     */
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

        if (! $currentPlayer && $room->isWaiting() && ! $room->isFull()) {
            if (Auth::check()) {
                $this->joinAsPlayer($room, false, null);
                $currentPlayer = $this->findCurrentPlayer($room);
                $room->load('players');
            }
        }

        $gameState = $this->buildGameState($room, $currentPlayer);

        return Inertia::render('Rooms/CubeTacGame', [
            'room' => $room,
            'currentPlayer' => $currentPlayer,
            'isHost' => $currentPlayer?->is_host ?? false,
            'gameState' => $gameState,
        ]);
    }

    /**
     * Render the local multiplayer (hotseat) page.
     *
     * Local mode is pure client state — no server round-trip per move,
     * no polling, no database writes. This endpoint just serves the
     * Inertia page; all game logic lives in the React component.
     */
    public function local(): Response
    {
        return Inertia::render('Rooms/CubeTac/LocalGame');
    }

    /**
     * Start a CubeTac game. Host only. Requires between game.min_players
     * and game.max_players connected players (inclusive). Slot order is
     * determined by join time.
     */
    public function start(Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer?->is_host) {
            abort(403, 'Only the host can start the game.');
        }

        $connectedPlayers = $room->connectedPlayers()->orderBy('created_at')->get();

        $min = $game->min_players;
        $max = $game->max_players;
        $count = $connectedPlayers->count();

        if ($count < $min || $count > $max) {
            return back()->withErrors(['error' => "CubeTac needs between {$min} and {$max} players."]);
        }

        /** @var list<int> $playerIds */
        $playerIds = $connectedPlayers->pluck('id')->values()->all();

        $settings = $this->freshGameState($playerIds);

        $room->update([
            'status' => 'playing',
            'started_at' => now(),
            'ended_at' => null,
            'winner' => null,
            'settings' => $settings,
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Mark an empty sticker with the current player's slot index.
     */
    public function mark(MarkStickerRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if (! $room->isPlaying()) {
            return back()->withErrors(['error' => 'Game is not in progress.']);
        }

        $settings = $room->settings ?? [];

        if (($settings['winner'] ?? null) !== null) {
            return back()->withErrors(['error' => 'Game is already over.']);
        }

        $expectedPlayerId = $this->expectedPlayerId($settings);
        if ($expectedPlayerId !== $currentPlayer->id) {
            return back()->withErrors(['error' => 'It is not your turn.']);
        }

        $face = (int) $request->validated('face');
        $row = (int) $request->validated('row');
        $col = (int) $request->validated('col');
        $idx = RubikCube::indexOf($face, $row, $col);

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        if ($marks[$idx] !== null) {
            return back()->withErrors(['error' => 'That sticker is already marked.']);
        }

        $slot = (int) $settings['current_turn'];
        $marks[$idx] = $slot;
        $settings['marks'] = $marks;
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'mark',
            'player' => $slot,
            'face' => $face,
            'row' => $row,
            'col' => $col,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Apply a quarter-turn to the cube on behalf of the current player.
     */
    public function rotate(RotateCubeRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if (! $room->isPlaying()) {
            return back()->withErrors(['error' => 'Game is not in progress.']);
        }

        $settings = $room->settings ?? [];

        if (($settings['winner'] ?? null) !== null) {
            return back()->withErrors(['error' => 'Game is already over.']);
        }

        $expectedPlayerId = $this->expectedPlayerId($settings);
        if ($expectedPlayerId !== $currentPlayer->id) {
            return back()->withErrors(['error' => 'It is not your turn.']);
        }

        /** @var string $move */
        $move = $request->validated('move');
        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];

        $settings['marks'] = RubikCube::apply($move, $marks);
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'rotate',
            'player' => (int) $settings['current_turn'],
            'move' => $move,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Reset a finished CubeTac game for a rematch. Host only. Rotates the
     * player order by one slot so the previous slot-0 opener moves to the
     * end and whoever was in slot 1 opens the rematch. For 2-player games
     * this degenerates to the original "swap X and O" behavior.
     */
    public function reset(Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer?->is_host) {
            abort(403, 'Only the host can reset the game.');
        }

        if (! $room->isFinished()) {
            return back()->withErrors(['error' => 'Can only reset finished games.']);
        }

        $settings = $room->settings ?? [];
        /** @var list<int> $previousIds */
        $previousIds = $settings['player_ids'] ?? [];

        $rotated = count($previousIds) > 1
            ? array_merge(array_slice($previousIds, 1), [$previousIds[0]])
            : $previousIds;

        $newSettings = $this->freshGameState($rotated);

        $room->update([
            'status' => 'playing',
            'started_at' => now(),
            'ended_at' => null,
            'winner' => null,
            'settings' => $newSettings,
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Build the game state for Inertia props. CubeTac has no hidden
     * information — every player sees everything.
     *
     * The `players` array is indexed by slot (same order as `player_ids`);
     * a slot whose player disconnected becomes `null`. `my_slot` is the
     * viewer's slot index, or `null` if the viewer isn't playing.
     *
     * @return array<string, mixed>|null
     */
    private function buildGameState(GameRoom $room, ?GamePlayer $currentPlayer): ?array
    {
        if (! $room->isPlaying() && ! $room->isFinished()) {
            return null;
        }

        $settings = $room->settings ?? [];
        $roomPlayers = $room->players()->get();

        /** @var list<int> $playerIds */
        $playerIds = $settings['player_ids'] ?? [];

        $playersBySlot = [];
        $mySlot = null;
        foreach ($playerIds as $slot => $playerId) {
            $player = $roomPlayers->firstWhere('id', $playerId);
            $playersBySlot[] = $player ? $this->serializePlayer($player) : null;
            if ($currentPlayer && $currentPlayer->id === $playerId) {
                $mySlot = $slot;
            }
        }

        $moveLimit = $settings['move_limit']
            ?? (count($playerIds) > 0 ? self::MOVES_PER_PLAYER * count($playerIds) : self::MOVES_PER_PLAYER * 2);

        return [
            'status' => $room->status,
            'marks' => $settings['marks'] ?? RubikCube::initialMarks(),
            'current_turn' => $settings['current_turn'] ?? 0,
            'move_count' => $settings['move_count'] ?? 0,
            'move_limit' => $moveLimit,
            'winner' => $settings['winner'] ?? null,
            'winning_lines' => $settings['winning_lines'] ?? [],
            'last_action' => $settings['last_action'] ?? null,
            'move_history' => $settings['move_history'] ?? [],
            'player_ids' => $playerIds,
            'current_player_id' => $currentPlayer?->id,
            'is_my_turn' => $currentPlayer !== null
                && $this->expectedPlayerId($settings) === $currentPlayer->id
                && ($settings['winner'] ?? null) === null,
            'my_slot' => $mySlot,
            'players' => $playersBySlot,
        ];
    }

    /**
     * @param  list<int>  $playerIds  Ordered slot-0..N-1 player IDs.
     * @return array<string, mixed>
     */
    private function freshGameState(array $playerIds): array
    {
        $count = count($playerIds);

        return [
            'marks' => RubikCube::initialMarks(),
            'current_turn' => 0,
            'move_count' => 0,
            'move_limit' => self::MOVES_PER_PLAYER * max(1, $count),
            'winner' => null,
            'winning_lines' => [],
            'last_action' => null,
            'move_history' => [],
            'player_ids' => array_values($playerIds),
        ];
    }

    /**
     * After a mark or rotate: check win / draw and advance to the next
     * slot if the game continues. `current_turn` is an int slot index
     * (0..N-1) that wraps via modular arithmetic.
     *
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function finalizeAfterAction(array $settings): array
    {
        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        $lines = RubikCube::winningLines($marks);
        $currentSlot = (int) $settings['current_turn'];

        if (count($lines) > 0) {
            $mine = array_values(array_filter($lines, fn ($l) => $l['player'] === $currentSlot));
            if (count($mine) > 0) {
                $settings['winner'] = $currentSlot;
                $settings['winning_lines'] = $mine;
            } else {
                // Only another player has a line, but by rule "the player
                // whose turn it was wins" — this primarily matters for
                // rotations that complete someone else's line.
                $settings['winner'] = $currentSlot;
                $settings['winning_lines'] = $lines;
            }

            return $settings;
        }

        // Draw on move limit OR full board
        $moveLimit = (int) ($settings['move_limit'] ?? self::MOVES_PER_PLAYER * 2);
        if (($settings['move_count'] ?? 0) >= $moveLimit
            || RubikCube::isComplete($marks)) {
            $settings['winner'] = 'draw';
            $settings['winning_lines'] = [];

            return $settings;
        }

        // Advance to the next slot
        /** @var list<int> $playerIds */
        $playerIds = $settings['player_ids'] ?? [];
        $n = max(1, count($playerIds));
        $settings['current_turn'] = ($currentSlot + 1) % $n;

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $settings
     * @param  array<string, mixed>  $action
     * @return array<string, mixed>
     */
    private function appendHistory(array $settings, array $action): array
    {
        $history = $settings['move_history'] ?? [];
        $history[] = $action;
        if (count($history) > self::HISTORY_CAP) {
            $history = array_slice($history, -self::HISTORY_CAP);
        }
        $settings['move_history'] = array_values($history);

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function expectedPlayerId(array $settings): ?int
    {
        $turn = $settings['current_turn'] ?? null;
        $playerIds = $settings['player_ids'] ?? [];
        if (! is_int($turn) || ! is_array($playerIds) || ! array_key_exists($turn, $playerIds)) {
            return null;
        }

        return $playerIds[$turn] ?? null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePlayer(GamePlayer $player): array
    {
        return [
            'id' => $player->id,
            'nickname' => $player->nickname,
            'avatar_color' => $player->avatar_color,
            'is_host' => $player->is_host,
            'is_connected' => $player->is_connected,
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

    private function joinAsPlayer(GameRoom $room, bool $isHost, ?string $nickname = null): GamePlayer
    {
        $user = Auth::user();

        // Deterministic slot-based color: first joiner gets slot 0, second
        // gets slot 1, etc. This mirrors the slot assignment that
        // freshGameState() will use when the host starts the game, so
        // avatar colors stay in sync with in-game glyph colors.
        $slot = $room->connectedPlayers()->count();
        $palette = self::SLOT_COLORS;
        $color = $palette[$slot] ?? $palette[count($palette) - 1];

        return GamePlayer::create([
            'game_room_id' => $room->id,
            'user_id' => $user?->id,
            'session_id' => session()->getId(),
            'nickname' => $nickname ?? $user?->name ?? 'Guest',
            'avatar_color' => $color,
            'is_host' => $isHost,
            'is_connected' => true,
        ]);
    }
}
