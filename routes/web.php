<?php

use App\Http\Controllers\GameController;
use App\Http\Controllers\GameRoomController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\TrioGameController;
use App\Models\Game;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $featuredGames = Game::query()
        ->where('is_active', true)
        ->orderBy('sort_order')
        ->limit(4)
        ->get();

    return Inertia::render('Welcome', [
        'featuredGames' => $featuredGames,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Game routes (public)
Route::get('/games', [GameController::class, 'index'])->name('games.index');
Route::get('/games/{game:slug}', [GameController::class, 'show'])->name('games.show');

// Room routes (public - guests allowed)
Route::post('/rooms', [GameRoomController::class, 'store'])->name('rooms.store');
Route::get('/rooms/join', [GameRoomController::class, 'showJoin'])->name('rooms.join');
Route::post('/rooms/join', [GameRoomController::class, 'join'])->name('rooms.join.submit');
Route::get('/rooms/{game:slug}/{room:room_code}', [GameRoomController::class, 'show'])->name('rooms.show');
Route::post('/rooms/{game:slug}/{room:room_code}/join-direct', [GameRoomController::class, 'joinDirect'])->name('rooms.joinDirect');
Route::post('/rooms/{game:slug}/{room:room_code}/start', [GameRoomController::class, 'start'])->name('rooms.start');
Route::post('/rooms/{game:slug}/{room:room_code}/leave', [GameRoomController::class, 'leave'])->name('rooms.leave');
Route::post('/rooms/{game:slug}/{room:room_code}/reset', [GameRoomController::class, 'reset'])->name('rooms.resetGame');

// Game action routes (Cheese Thief)
Route::post('/rooms/{game:slug}/{room:room_code}/confirm-roll', [GameRoomController::class, 'confirmRoll'])->name('rooms.confirmRoll');
Route::post('/rooms/{game:slug}/{room:room_code}/peek', [GameRoomController::class, 'peek'])->name('rooms.peek');
Route::post('/rooms/{game:slug}/{room:room_code}/skip-peek', [GameRoomController::class, 'skipPeek'])->name('rooms.skipPeek');
Route::post('/rooms/{game:slug}/{room:room_code}/select-accomplice', [GameRoomController::class, 'selectAccomplice'])->name('rooms.selectAccomplice');
Route::post('/rooms/{game:slug}/{room:room_code}/vote', [GameRoomController::class, 'vote'])->name('rooms.vote');
Route::post('/rooms/{game:slug}/{room:room_code}/chat', [GameRoomController::class, 'sendMessage'])->name('rooms.chat');
Route::get('/rooms/{game:slug}/{room:room_code}/messages', [GameRoomController::class, 'getMessages'])->name('rooms.messages');

// Voice chat routes
Route::post('/rooms/{game:slug}/{room:room_code}/voice/signal', [GameRoomController::class, 'sendSignal'])->name('rooms.voice.signal');
Route::get('/rooms/{game:slug}/{room:room_code}/voice/signals', [GameRoomController::class, 'getSignals'])->name('rooms.voice.signals');
Route::post('/rooms/{game:slug}/{room:room_code}/voice/toggle-mute', [GameRoomController::class, 'toggleMute'])->name('rooms.voice.toggleMute');
Route::get('/rooms/{game:slug}/{room:room_code}/voice/status', [GameRoomController::class, 'getVoiceStatus'])->name('rooms.voice.status');

// Trio game routes
Route::post('/rooms/{game:slug}/{room:room_code}/trio/start', [TrioGameController::class, 'start'])->name('rooms.trio.start');
Route::post('/rooms/{game:slug}/{room:room_code}/trio/reveal-card', [TrioGameController::class, 'revealCard'])->name('rooms.trio.revealCard');
Route::post('/rooms/{game:slug}/{room:room_code}/trio/claim-trio', [TrioGameController::class, 'claimTrio'])->name('rooms.trio.claimTrio');
Route::post('/rooms/{game:slug}/{room:room_code}/trio/end-turn', [TrioGameController::class, 'endTurn'])->name('rooms.trio.endTurn');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// Backwards compatibility redirect for old room URLs
Route::get('/rooms/{room:room_code}', function (\App\Models\GameRoom $room) {
    return redirect()->route('rooms.show', [$room->game->slug, $room->room_code], 301);
})->name('rooms.show.legacy');

require __DIR__.'/auth.php';
