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
    private const MOVE_LIMIT = 60;

    private const HISTORY_CAP = 20;

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
     * Start a CubeTac game. Host only. Requires exactly 2 connected players.
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

        if ($connectedPlayers->count() !== 2) {
            return back()->withErrors(['error' => 'CubeTac needs exactly 2 players.']);
        }

        $xPlayer = $connectedPlayers->first();
        $oPlayer = $connectedPlayers->last();

        $settings = $this->freshGameState($xPlayer->id, $oPlayer->id);

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
     * Mark an empty sticker with the current player's symbol.
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

        /** @var array<int, string|null> $marks */
        $marks = $settings['marks'];
        if ($marks[$idx] !== null) {
            return back()->withErrors(['error' => 'That sticker is already marked.']);
        }

        $symbol = $settings['current_turn'];
        $marks[$idx] = $symbol;
        $settings['marks'] = $marks;
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'mark',
            'player' => $symbol,
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
            'winner' => $settings['winner'],
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
        /** @var array<int, string|null> $marks */
        $marks = $settings['marks'];

        $settings['marks'] = RubikCube::apply($move, $marks);
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'rotate',
            'player' => $settings['current_turn'],
            'move' => $move,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'],
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Reset a finished CubeTac game for a rematch. Host only. Swaps X and O.
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
        $previousX = $settings['x_player_id'] ?? null;
        $previousO = $settings['o_player_id'] ?? null;

        // Swap X and O so the previous O (loser on wins, or either on draw)
        // goes first in the rematch.
        $newSettings = $this->freshGameState(
            $previousO ?? $previousX,
            $previousX ?? $previousO,
        );

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
     * information — both players see everything.
     *
     * @return array<string, mixed>|null
     */
    private function buildGameState(GameRoom $room, ?GamePlayer $currentPlayer): ?array
    {
        if (! $room->isPlaying() && ! $room->isFinished()) {
            return null;
        }

        $settings = $room->settings ?? [];
        $players = $room->connectedPlayers()->get();

        $xPlayerId = $settings['x_player_id'] ?? null;
        $oPlayerId = $settings['o_player_id'] ?? null;
        $xPlayer = $players->firstWhere('id', $xPlayerId);
        $oPlayer = $players->firstWhere('id', $oPlayerId);

        $mySymbol = null;
        if ($currentPlayer) {
            if ($currentPlayer->id === $xPlayerId) {
                $mySymbol = 'X';
            } elseif ($currentPlayer->id === $oPlayerId) {
                $mySymbol = 'O';
            }
        }

        return [
            'status' => $room->status,
            'marks' => $settings['marks'] ?? RubikCube::initialMarks(),
            'current_turn' => $settings['current_turn'] ?? 'X',
            'move_count' => $settings['move_count'] ?? 0,
            'move_limit' => $settings['move_limit'] ?? self::MOVE_LIMIT,
            'winner' => $settings['winner'] ?? null,
            'winning_lines' => $settings['winning_lines'] ?? [],
            'last_action' => $settings['last_action'] ?? null,
            'move_history' => $settings['move_history'] ?? [],
            'x_player_id' => $xPlayerId,
            'o_player_id' => $oPlayerId,
            'current_player_id' => $currentPlayer?->id,
            'is_my_turn' => $currentPlayer !== null
                && $this->expectedPlayerId($settings) === $currentPlayer->id
                && ($settings['winner'] ?? null) === null,
            'my_symbol' => $mySymbol,
            'players' => [
                'x' => $xPlayer ? $this->serializePlayer($xPlayer) : null,
                'o' => $oPlayer ? $this->serializePlayer($oPlayer) : null,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function freshGameState(int $xPlayerId, int $oPlayerId): array
    {
        return [
            'marks' => RubikCube::initialMarks(),
            'current_turn' => 'X',
            'move_count' => 0,
            'move_limit' => self::MOVE_LIMIT,
            'winner' => null,
            'winning_lines' => [],
            'last_action' => null,
            'move_history' => [],
            'x_player_id' => $xPlayerId,
            'o_player_id' => $oPlayerId,
        ];
    }

    /**
     * After a mark or rotate: check win / draw and swap turns if the game continues.
     *
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function finalizeAfterAction(array $settings): array
    {
        /** @var array<int, string|null> $marks */
        $marks = $settings['marks'];
        $lines = RubikCube::winningLines($marks);
        $currentSymbol = $settings['current_turn'];

        if (count($lines) > 0) {
            $mine = array_values(array_filter($lines, fn ($l) => $l['player'] === $currentSymbol));
            if (count($mine) > 0) {
                $settings['winner'] = $currentSymbol;
                $settings['winning_lines'] = $mine;
            } else {
                // Only opponent has lines — but "player whose turn it was wins."
                $settings['winner'] = $currentSymbol;
                $settings['winning_lines'] = $lines;
            }

            return $settings;
        }

        // Draw on move limit OR full board
        if (($settings['move_count'] ?? 0) >= ($settings['move_limit'] ?? self::MOVE_LIMIT)
            || RubikCube::isComplete($marks)) {
            $settings['winner'] = 'draw';
            $settings['winning_lines'] = [];

            return $settings;
        }

        // Swap turn
        $settings['current_turn'] = $currentSymbol === 'X' ? 'O' : 'X';

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
        if ($turn === 'X') {
            return $settings['x_player_id'] ?? null;
        }
        if ($turn === 'O') {
            return $settings['o_player_id'] ?? null;
        }

        return null;
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
        $colors = ['#ff4d2e', '#3a90ff', '#22d3ee', '#a855f7', '#f59e0b', '#10b981'];

        return GamePlayer::create([
            'game_room_id' => $room->id,
            'user_id' => $user?->id,
            'session_id' => session()->getId(),
            'nickname' => $nickname ?? $user?->name ?? 'Guest',
            'avatar_color' => $colors[array_rand($colors)],
            'is_host' => $isHost,
            'is_connected' => true,
        ]);
    }
}
