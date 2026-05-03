<?php

namespace App\Http\Controllers;

use App\Http\Requests\MarkIcosahedronCellRequest;
use App\Http\Requests\MarkMegaminxCellRequest;
use App\Http\Requests\MarkOctahedronCellRequest;
use App\Http\Requests\MarkPyraminxCellRequest;
use App\Http\Requests\MarkStickerRequest;
use App\Http\Requests\PickCubeTacDesignRequest;
use App\Http\Requests\RotateCubeRequest;
use App\Http\Requests\RotateIcosahedronRequest;
use App\Http\Requests\RotateMegaminxRequest;
use App\Http\Requests\RotateOctahedronRequest;
use App\Http\Requests\RotatePyraminxRequest;
use App\Models\Game;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Services\IcosahedronCube;
use App\Services\MegaminxCube;
use App\Services\OctahedronCube;
use App\Services\PyraminxCube;
use App\Services\RubikCube;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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

    private const VARIANT_CUBE = 'cube';

    private const VARIANT_MEGAMINX = 'megaminx';

    private const VARIANT_PYRAMINX = 'pyraminx';

    private const VARIANT_OCTAHEDRON = 'octahedron';

    private const VARIANT_ICOSAHEDRON = 'icosahedron';

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

        // Players auto-joined through the shared GameRoomController have no
        // cubetac_design yet — backfill one here so the picker and the cube
        // glyph have a concrete value to render from the first load.
        if ($currentPlayer && ($currentPlayer->game_data['cubetac_design'] ?? null) === null) {
            $this->ensureDesign($room, $currentPlayer);
            $room->load('players');
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

        $settings = $this->freshStateForVariant($this->variantOf($room), $playerIds);

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

        if ($this->variantOf($room) !== self::VARIANT_CUBE) {
            return back()->withErrors(['error' => 'This room is not playing the cube variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
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

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_CUBE, requireConfirm: true);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

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

        if ($this->variantOf($room) !== self::VARIANT_CUBE) {
            return back()->withErrors(['error' => 'This room is not playing the cube variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
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

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_CUBE, requireConfirm: false);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

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

        $newSettings = $this->freshStateForVariant($this->variantOf($room), $rotated);

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
     * Let a waiting-room player pick which glyph (X, O, △, ▢, ✚, ⬡)
     * represents them on the cube. Self-only, waiting-phase only, uniqueness
     * enforced server-side inside a transaction. Updates `avatar_color` to
     * match so color and glyph stay in sync.
     */
    public function pickDesign(PickCubeTacDesignRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        $currentPlayer = $this->findCurrentPlayer($room);

        if (! $currentPlayer) {
            abort(403, 'You are not a player in this room.');
        }

        if (! $room->isWaiting()) {
            return back()->withErrors(['error' => 'Designs are locked once the game starts.']);
        }

        $design = (int) $request->validated('design');

        DB::transaction(function () use ($room, $currentPlayer, $design) {
            $conflict = $room->players()
                ->where('id', '!=', $currentPlayer->id)
                ->get()
                ->contains(function (GamePlayer $other) use ($design) {
                    return ($other->game_data['cubetac_design'] ?? null) === $design;
                });

            if ($conflict) {
                abort(422, 'That design is already taken by another player.');
            }

            $currentPlayer->update([
                'game_data' => array_merge($currentPlayer->game_data ?? [], ['cubetac_design' => $design]),
                'avatar_color' => self::SLOT_COLORS[$design] ?? self::SLOT_COLORS[0],
            ]);
        });

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
        $designsBySlot = [];
        $mySlot = null;
        foreach ($playerIds as $slot => $playerId) {
            $player = $roomPlayers->firstWhere('id', $playerId);
            $serialized = $player ? $this->serializePlayer($player, $slot) : null;
            $playersBySlot[] = $serialized;
            $designsBySlot[] = $serialized['design'] ?? $slot;
            if ($currentPlayer && $currentPlayer->id === $playerId) {
                $mySlot = $slot;
            }
        }

        $moveLimit = $settings['move_limit']
            ?? (count($playerIds) > 0 ? self::MOVES_PER_PLAYER * count($playerIds) : self::MOVES_PER_PLAYER * 2);

        $variant = $this->variantOf($room);
        $emptyMarks = match ($variant) {
            self::VARIANT_MEGAMINX => MegaminxCube::initialMarks(),
            self::VARIANT_PYRAMINX => PyraminxCube::initialMarks(),
            self::VARIANT_OCTAHEDRON => OctahedronCube::initialMarks(),
            self::VARIANT_ICOSAHEDRON => IcosahedronCube::initialMarks(),
            default => RubikCube::initialMarks(),
        };

        return [
            'status' => $room->status,
            'variant' => $variant,
            'marks' => $settings['marks'] ?? $emptyMarks,
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
            'pending_action' => (bool) ($settings['pending_action'] ?? false),
            'my_slot' => $mySlot,
            'players' => $playersBySlot,
            'designs' => $designsBySlot,
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
            'pending_action' => false,
            'player_ids' => array_values($playerIds),
        ];
    }

    /**
     * Initial state for a Megaminx-variant game. Same shape as the cube
     * variant but the marks array is 132 cells instead of 54 (12 faces ×
     * 11 cells, with the centers — slot 0 of each face — never marked).
     *
     * @param  list<int>  $playerIds
     * @return array<string, mixed>
     */
    private function freshMegaminxState(array $playerIds): array
    {
        $count = count($playerIds);

        return [
            'marks' => MegaminxCube::initialMarks(),
            'current_turn' => 0,
            'move_count' => 0,
            'move_limit' => self::MOVES_PER_PLAYER * max(1, $count),
            'winner' => null,
            'winning_lines' => [],
            'last_action' => null,
            'move_history' => [],
            'pending_action' => false,
            'player_ids' => array_values($playerIds),
        ];
    }

    /**
     * Initial state for a Pyraminx-variant game. 36-cell marks array (4 faces ×
     * 9 cells), with the 3 down-triangles per face — slots 6,7,8 — never marked.
     *
     * @param  list<int>  $playerIds
     * @return array<string, mixed>
     */
    private function freshPyraminxState(array $playerIds): array
    {
        $count = count($playerIds);

        return [
            'marks' => PyraminxCube::initialMarks(),
            'current_turn' => 0,
            'move_count' => 0,
            'move_limit' => self::MOVES_PER_PLAYER * max(1, $count),
            'winner' => null,
            'winning_lines' => [],
            'last_action' => null,
            'move_history' => [],
            'pending_action' => false,
            'player_ids' => array_values($playerIds),
        ];
    }

    /**
     * Initial state for an Octahedron-variant game. 72-cell marks array (8 faces ×
     * 9 cells), with the 3 down-triangles per face — slots 6,7,8 — never marked.
     *
     * @param  list<int>  $playerIds
     * @return array<string, mixed>
     */
    private function freshOctahedronState(array $playerIds): array
    {
        $count = count($playerIds);

        return [
            'marks' => OctahedronCube::initialMarks(),
            'current_turn' => 0,
            'move_count' => 0,
            'move_limit' => self::MOVES_PER_PLAYER * max(1, $count),
            'winner' => null,
            'winning_lines' => [],
            'last_action' => null,
            'move_history' => [],
            'pending_action' => false,
            'player_ids' => array_values($playerIds),
        ];
    }

    /**
     * Initial state for an Icosahedron-variant game. 180-cell marks array (20 faces ×
     * 9 cells), with the 3 down-triangles per face — slots 6,7,8 — never marked.
     *
     * @param  list<int>  $playerIds
     * @return array<string, mixed>
     */
    private function freshIcosahedronState(array $playerIds): array
    {
        $count = count($playerIds);

        return [
            'marks' => IcosahedronCube::initialMarks(),
            'current_turn' => 0,
            'move_count' => 0,
            'move_limit' => self::MOVES_PER_PLAYER * max(1, $count),
            'winner' => null,
            'winning_lines' => [],
            'last_action' => null,
            'move_history' => [],
            'pending_action' => false,
            'player_ids' => array_values($playerIds),
        ];
    }

    /**
     * Build the fresh-game settings payload for the variant in play.
     *
     * @param  self::VARIANT_CUBE|self::VARIANT_MEGAMINX|self::VARIANT_PYRAMINX|self::VARIANT_OCTAHEDRON|self::VARIANT_ICOSAHEDRON  $variant
     * @param  list<int>  $playerIds
     * @return array<string, mixed>
     */
    private function freshStateForVariant(string $variant, array $playerIds): array
    {
        return match ($variant) {
            self::VARIANT_MEGAMINX => $this->freshMegaminxState($playerIds),
            self::VARIANT_PYRAMINX => $this->freshPyraminxState($playerIds),
            self::VARIANT_OCTAHEDRON => $this->freshOctahedronState($playerIds),
            self::VARIANT_ICOSAHEDRON => $this->freshIcosahedronState($playerIds),
            default => $this->freshGameState($playerIds),
        };
    }

    /**
     * Mark a cell on the Megaminx with the current player's slot index.
     * Same flow as `mark()` but for the 12-face × 11-cell shape, and only
     * legal in rooms whose `variant` is `megaminx`.
     */
    public function megaMark(MarkMegaminxCellRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_MEGAMINX) {
            return back()->withErrors(['error' => 'This room is not playing the megaminx variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        $slot = (int) $request->validated('slot');
        $idx = MegaminxCube::indexOf($face, $slot);

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        if ($marks[$idx] !== null) {
            return back()->withErrors(['error' => 'That cell is already marked.']);
        }

        $playerSlot = (int) $settings['current_turn'];
        $marks[$idx] = $playerSlot;
        $settings['marks'] = $marks;
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'mega_mark',
            'player' => $playerSlot,
            'face' => $face,
            'slot' => $slot,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_MEGAMINX, requireConfirm: true);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Rotate a Megaminx face 72° in the requested direction. Auto-advances
     * the turn (no Confirm Turn step), mirroring `rotate()` for the cube.
     */
    public function megaRotate(RotateMegaminxRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_MEGAMINX) {
            return back()->withErrors(['error' => 'This room is not playing the megaminx variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        /** @var 'cw'|'ccw' $direction */
        $direction = $request->validated('direction');

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];

        $settings['marks'] = MegaminxCube::apply($face, $direction, $marks);
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'mega_rotate',
            'player' => (int) $settings['current_turn'],
            'face' => $face,
            'direction' => $direction,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_MEGAMINX, requireConfirm: false);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Mark a perimeter cell on the Pyraminx with the current player's slot
     * index. Same flow as `mark()` but for the 4-face × 9-cell tetrahedron,
     * and only legal in rooms whose `variant` is `pyraminx`.
     */
    public function pyraMark(MarkPyraminxCellRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_PYRAMINX) {
            return back()->withErrors(['error' => 'This room is not playing the pyraminx variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        $slot = (int) $request->validated('slot');
        $idx = PyraminxCube::indexOf($face, $slot);

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        if ($marks[$idx] !== null) {
            return back()->withErrors(['error' => 'That cell is already marked.']);
        }

        $playerSlot = (int) $settings['current_turn'];
        $marks[$idx] = $playerSlot;
        $settings['marks'] = $marks;
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'pyra_mark',
            'player' => $playerSlot,
            'face' => $face,
            'slot' => $slot,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_PYRAMINX, requireConfirm: true);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Rotate a Pyraminx face 120° in the requested direction. Auto-advances
     * the turn (no Confirm Turn step), mirroring `rotate()` for the cube.
     */
    public function pyraRotate(RotatePyraminxRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_PYRAMINX) {
            return back()->withErrors(['error' => 'This room is not playing the pyraminx variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        /** @var 'cw'|'ccw' $direction */
        $direction = $request->validated('direction');

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];

        $settings['marks'] = PyraminxCube::apply($face, $direction, $marks);
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'pyra_rotate',
            'player' => (int) $settings['current_turn'],
            'face' => $face,
            'direction' => $direction,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_PYRAMINX, requireConfirm: false);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Mark a perimeter cell on the Octahedron with the current player's slot
     * index. Same flow as `mark()` but for the 8-face × 9-cell octahedron,
     * and only legal in rooms whose `variant` is `octahedron`.
     */
    public function octaMark(MarkOctahedronCellRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_OCTAHEDRON) {
            return back()->withErrors(['error' => 'This room is not playing the octahedron variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        $slot = (int) $request->validated('slot');
        $idx = OctahedronCube::indexOf($face, $slot);

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        if ($marks[$idx] !== null) {
            return back()->withErrors(['error' => 'That cell is already marked.']);
        }

        $playerSlot = (int) $settings['current_turn'];
        $marks[$idx] = $playerSlot;
        $settings['marks'] = $marks;
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'octa_mark',
            'player' => $playerSlot,
            'face' => $face,
            'slot' => $slot,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_OCTAHEDRON, requireConfirm: true);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Rotate an Octahedron face 120° in the requested direction. Auto-advances
     * the turn (no Confirm Turn step), mirroring `rotate()` for the cube.
     */
    public function octaRotate(RotateOctahedronRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_OCTAHEDRON) {
            return back()->withErrors(['error' => 'This room is not playing the octahedron variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        /** @var 'cw'|'ccw' $direction */
        $direction = $request->validated('direction');

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];

        $settings['marks'] = OctahedronCube::apply($face, $direction, $marks);
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'octa_rotate',
            'player' => (int) $settings['current_turn'],
            'face' => $face,
            'direction' => $direction,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_OCTAHEDRON, requireConfirm: false);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Mark a perimeter cell on the Icosahedron with the current player's slot
     * index. Same flow as `mark()` but for the 20-face × 9-cell icosahedron,
     * and only legal in rooms whose `variant` is `icosahedron`.
     */
    public function icosaMark(MarkIcosahedronCellRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_ICOSAHEDRON) {
            return back()->withErrors(['error' => 'This room is not playing the icosahedron variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        $slot = (int) $request->validated('slot');
        $idx = IcosahedronCube::indexOf($face, $slot);

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        if ($marks[$idx] !== null) {
            return back()->withErrors(['error' => 'That cell is already marked.']);
        }

        $playerSlot = (int) $settings['current_turn'];
        $marks[$idx] = $playerSlot;
        $settings['marks'] = $marks;
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'icosa_mark',
            'player' => $playerSlot,
            'face' => $face,
            'slot' => $slot,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_ICOSAHEDRON, requireConfirm: true);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Rotate an Icosahedron face 120° in the requested direction. Auto-advances
     * the turn (no Confirm Turn step), mirroring `rotate()` for the cube.
     */
    public function icosaRotate(RotateIcosahedronRequest $request, Game $game, GameRoom $room): RedirectResponse
    {
        if ($room->game_id !== $game->id) {
            abort(404, 'Room not found for this game.');
        }

        if ($this->variantOf($room) !== self::VARIANT_ICOSAHEDRON) {
            return back()->withErrors(['error' => 'This room is not playing the icosahedron variant.']);
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

        if ($settings['pending_action'] ?? false) {
            return back()->withErrors(['error' => 'Confirm your turn before taking another action.']);
        }

        $face = (int) $request->validated('face');
        /** @var 'cw'|'ccw' $direction */
        $direction = $request->validated('direction');

        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];

        $settings['marks'] = IcosahedronCube::apply($face, $direction, $marks);
        $settings['move_count'] = ($settings['move_count'] ?? 0) + 1;

        $action = [
            'type' => 'icosa_rotate',
            'player' => (int) $settings['current_turn'],
            'face' => $face,
            'direction' => $direction,
            'move_id' => $settings['move_count'],
        ];
        $settings['last_action'] = $action;
        $settings = $this->appendHistory($settings, $action);

        $settings = $this->finalizeAfterAction($settings, self::VARIANT_ICOSAHEDRON, requireConfirm: false);

        $room->update([
            'settings' => $settings,
            'winner' => $settings['winner'] !== null ? (string) $settings['winner'] : null,
            'status' => $settings['winner'] !== null ? 'finished' : 'playing',
            'ended_at' => $settings['winner'] !== null ? now() : null,
        ]);

        $this->recordGameEnd($room, $settings);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Resolve the active variant for a room. Defaults to "cube" for rows
     * created before the variant column existed.
     *
     * @return self::VARIANT_CUBE|self::VARIANT_MEGAMINX|self::VARIANT_PYRAMINX|self::VARIANT_OCTAHEDRON|self::VARIANT_ICOSAHEDRON
     */
    private function variantOf(GameRoom $room): string
    {
        return match ($room->variant) {
            self::VARIANT_MEGAMINX => self::VARIANT_MEGAMINX,
            self::VARIANT_PYRAMINX => self::VARIANT_PYRAMINX,
            self::VARIANT_OCTAHEDRON => self::VARIANT_OCTAHEDRON,
            self::VARIANT_ICOSAHEDRON => self::VARIANT_ICOSAHEDRON,
            default => self::VARIANT_CUBE,
        };
    }

    /**
     * After a mark or rotate: check win / draw. If the game continues,
     * either auto-advance the turn (rotate) or flag `pending_action`
     * so the UI shows a Confirm Turn button (mark).
     *
     * @param  array<string, mixed>  $settings
     * @param  self::VARIANT_CUBE|self::VARIANT_MEGAMINX|self::VARIANT_PYRAMINX|self::VARIANT_OCTAHEDRON|self::VARIANT_ICOSAHEDRON  $variant
     * @return array<string, mixed>
     */
    private function finalizeAfterAction(array $settings, string $variant, bool $requireConfirm): array
    {
        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        $lines = match ($variant) {
            self::VARIANT_MEGAMINX => MegaminxCube::winningLines($marks),
            self::VARIANT_PYRAMINX => PyraminxCube::winningLines($marks),
            self::VARIANT_OCTAHEDRON => OctahedronCube::winningLines($marks),
            self::VARIANT_ICOSAHEDRON => IcosahedronCube::winningLines($marks),
            default => RubikCube::winningLines($marks),
        };
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
            $settings['pending_action'] = false;

            return $settings;
        }

        // Draw on move limit OR full board
        $moveLimit = (int) ($settings['move_limit'] ?? self::MOVES_PER_PLAYER * 2);
        $isFull = match ($variant) {
            self::VARIANT_MEGAMINX => MegaminxCube::isComplete($marks),
            self::VARIANT_PYRAMINX => PyraminxCube::isComplete($marks),
            self::VARIANT_OCTAHEDRON => OctahedronCube::isComplete($marks),
            self::VARIANT_ICOSAHEDRON => IcosahedronCube::isComplete($marks),
            default => RubikCube::isComplete($marks),
        };
        if (($settings['move_count'] ?? 0) >= $moveLimit || $isFull) {
            $settings['winner'] = 'draw';
            $settings['winning_lines'] = [];
            $settings['pending_action'] = false;

            return $settings;
        }

        if ($requireConfirm) {
            // Game continues — wait for the current player to click
            // Confirm Turn (handled by endTurn()). Slot stays put.
            $settings['pending_action'] = true;

            return $settings;
        }

        // Rotations auto-advance the turn — no confirm step.
        /** @var list<int> $playerIds */
        $playerIds = $settings['player_ids'] ?? [];
        $n = max(1, count($playerIds));
        $settings['current_turn'] = ($currentSlot + 1) % $n;
        $settings['pending_action'] = false;

        return $settings;
    }

    /**
     * Undo a pending mark. The current player clicked a sticker but hasn't
     * yet confirmed; clicking the same sticker again calls this endpoint
     * to take the mark back. Rotations cannot be undone — they auto-confirm.
     */
    public function undoMark(Game $game, GameRoom $room): RedirectResponse
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

        if (! ($settings['pending_action'] ?? false)) {
            return back()->withErrors(['error' => 'Nothing to undo.']);
        }

        $last = $settings['last_action'] ?? null;
        $lastType = is_array($last) ? ($last['type'] ?? null) : null;
        if ($lastType !== 'mark' && $lastType !== 'mega_mark') {
            return back()->withErrors(['error' => 'Only marks can be undone.']);
        }

        $idx = $lastType === 'mega_mark'
            ? MegaminxCube::indexOf((int) $last['face'], (int) $last['slot'])
            : RubikCube::indexOf((int) $last['face'], (int) $last['row'], (int) $last['col']);
        /** @var array<int, int|null> $marks */
        $marks = $settings['marks'];
        $marks[$idx] = null;
        $settings['marks'] = $marks;
        $settings['move_count'] = max(0, ((int) ($settings['move_count'] ?? 0)) - 1);
        $settings['pending_action'] = false;

        // Pop the mark from history if it was the most recent entry.
        $history = $settings['move_history'] ?? [];
        if (! empty($history) && ($history[count($history) - 1]['move_id'] ?? null) === ($last['move_id'] ?? null)) {
            array_pop($history);
            $settings['move_history'] = array_values($history);
        }
        $settings['last_action'] = null;

        $room->update(['settings' => $settings]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
    }

    /**
     * Advance to the next slot after the current player has taken their
     * mark or rotate action and clicked "Confirm Turn".
     */
    public function endTurn(Game $game, GameRoom $room): RedirectResponse
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

        if (! ($settings['pending_action'] ?? false)) {
            return back()->withErrors(['error' => 'Take an action before ending your turn.']);
        }

        /** @var list<int> $playerIds */
        $playerIds = $settings['player_ids'] ?? [];
        $n = max(1, count($playerIds));
        $currentSlot = (int) $settings['current_turn'];
        $settings['current_turn'] = ($currentSlot + 1) % $n;
        $settings['pending_action'] = false;

        $room->update(['settings' => $settings]);

        return redirect()->route('rooms.show', [$game->slug, $room->room_code]);
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
    private function serializePlayer(GamePlayer $player, int $fallbackDesign = 0): array
    {
        return [
            'id' => $player->id,
            'nickname' => $player->nickname,
            'avatar_color' => $player->avatar_color,
            'is_host' => $player->is_host,
            'is_connected' => $player->is_connected,
            'wins' => $player->wins,
            'design' => $this->designFor($player, $fallbackDesign),
        ];
    }

    /**
     * Per-player glyph design index (0..5). Pulled from the model's
     * `game_data['cubetac_design']` bag, falling back to `$fallback` (typically
     * the slot index) for rows that predate the picker feature.
     */
    private function designFor(GamePlayer $player, int $fallback = 0): int
    {
        $design = $player->game_data['cubetac_design'] ?? null;
        if (is_int($design) && $design >= 0 && $design <= 5) {
            return $design;
        }

        return $fallback;
    }

    /**
     * Record cumulative side effects when a game transitions to `finished`:
     * always bumps the room's `games_played` (wins and draws alike), and
     * credits the winner's `wins` when a slot won decisively. Relies on the
     * mark/rotate handlers' guards to fire at most once per game transition.
     *
     * @param  array<string, mixed>  $settings
     */
    private function recordGameEnd(GameRoom $room, array $settings): void
    {
        $winner = $settings['winner'] ?? null;
        if ($winner === null) {
            return;
        }

        $room->increment('games_played');

        if (! is_int($winner)) {
            return;
        }

        /** @var list<int> $playerIds */
        $playerIds = $settings['player_ids'] ?? [];
        $winnerPlayerId = $playerIds[$winner] ?? null;
        if ($winnerPlayerId === null) {
            return;
        }

        GamePlayer::whereKey($winnerPlayerId)->increment('wins');
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

        // Auto-assign the first design (X, O, △, ▢, ✚, ⬡) not already taken
        // by another player in the room (including disconnected rows — they
        // keep their glyph for reconnects). Avatar color follows design so
        // the two stay visually aligned.
        $design = $this->firstAvailableDesign($room);
        $palette = self::SLOT_COLORS;
        $color = $palette[$design] ?? $palette[count($palette) - 1];

        return GamePlayer::create([
            'game_room_id' => $room->id,
            'user_id' => $user?->id,
            'session_id' => session()->getId(),
            'nickname' => $nickname ?? $user?->name ?? 'Guest',
            'avatar_color' => $color,
            'is_host' => $isHost,
            'is_connected' => true,
            'game_data' => ['cubetac_design' => $design],
        ]);
    }

    /**
     * Backfill `cubetac_design` on a player that was auto-joined via the
     * shared GameRoomController path (which doesn't know about cubetac).
     * Also syncs `avatar_color` to the design's palette color.
     */
    private function ensureDesign(GameRoom $room, GamePlayer $player): void
    {
        $design = $this->firstAvailableDesign($room);
        $player->update([
            'game_data' => array_merge($player->game_data ?? [], ['cubetac_design' => $design]),
            'avatar_color' => self::SLOT_COLORS[$design] ?? self::SLOT_COLORS[0],
        ]);
    }

    /**
     * Pick the lowest design index (0..5) not currently held by any player
     * in the room. Falls back to 5 if the palette is fully used (shouldn't
     * happen for 6-max rooms, but keeps this total).
     */
    private function firstAvailableDesign(GameRoom $room): int
    {
        $taken = [];
        foreach ($room->players as $existing) {
            $d = $existing->game_data['cubetac_design'] ?? null;
            if (is_int($d)) {
                $taken[$d] = true;
            }
        }

        for ($i = 0; $i < count(self::SLOT_COLORS); $i++) {
            if (! isset($taken[$i])) {
                return $i;
            }
        }

        return count(self::SLOT_COLORS) - 1;
    }
}
