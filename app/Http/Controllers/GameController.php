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
            ->where('is_public', true)
            ->with(['host:id,name', 'connectedPlayers:id,game_room_id,nickname,avatar_color'])
            ->withCount('connectedPlayers')
            ->latest()
            ->limit(10)
            ->get();

        // CubeTac uses a custom "mode select hub" page instead of the generic
        // Games/Show layout.
        if ($game->slug === 'cubetac') {
            return Inertia::render('Games/CubeTacHub', [
                'game' => $game,
                'waitingRooms' => $waitingRooms,
            ]);
        }

        return Inertia::render('Games/Show', [
            'game' => $game,
            'waitingRooms' => $waitingRooms,
        ]);
    }
}
