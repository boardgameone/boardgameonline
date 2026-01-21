<?php

namespace App\Http\Controllers;

use App\Models\Game;
use Inertia\Inertia;
use Inertia\Response;

class GameController extends Controller
{
    public function index(): Response
    {
        $games = Game::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->withCount(['activeRooms' => function ($query) {
                $query->where('status', 'waiting');
            }])
            ->get();

        return Inertia::render('Games/Index', [
            'games' => $games,
        ]);
    }

    public function show(Game $game): Response
    {
        if (! $game->is_active) {
            abort(404);
        }

        $waitingRooms = $game->rooms()
            ->where('status', 'waiting')
            ->with(['host:id,name', 'connectedPlayers:id,game_room_id,nickname,avatar_color'])
            ->withCount('connectedPlayers')
            ->latest()
            ->limit(10)
            ->get();

        return Inertia::render('Games/Show', [
            'game' => $game,
            'waitingRooms' => $waitingRooms,
        ]);
    }
}
