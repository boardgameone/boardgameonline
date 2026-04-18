<?php

use App\Http\Controllers\CubeTacGameController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\GameRoomController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\TrioGameController;
use App\Http\Controllers\TwentyEightGameController;
use App\Models\Game;
use App\Models\GameRoom;
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
Route::post('/rooms', [GameRoomController::class, 'store'])->middleware('throttle:20,1')->name('rooms.store');
Route::get('/rooms/join', [GameRoomController::class, 'showJoin'])->name('rooms.join');
Route::post('/rooms/join', [GameRoomController::class, 'join'])->middleware('throttle:20,1')->name('rooms.join.submit');
Route::get('/rooms/{game:slug}/{room:room_code}', [GameRoomController::class, 'show'])->name('rooms.show');
Route::post('/rooms/{game:slug}/{room:room_code}/join-direct', [GameRoomController::class, 'joinDirect'])->middleware('throttle:20,1')->name('rooms.joinDirect');
Route::post('/rooms/{game:slug}/{room:room_code}/start', [GameRoomController::class, 'start'])->middleware('throttle:20,1')->name('rooms.start');
Route::post('/rooms/{game:slug}/{room:room_code}/leave', [GameRoomController::class, 'leave'])->middleware('throttle:20,1')->name('rooms.leave');
Route::post('/rooms/{game:slug}/{room:room_code}/reset', [GameRoomController::class, 'reset'])->middleware('throttle:20,1')->name('rooms.resetGame');

// Game action routes (Cheese Thief)
Route::post('/rooms/{game:slug}/{room:room_code}/confirm-roll', [GameRoomController::class, 'confirmRoll'])->middleware('throttle:60,1')->name('rooms.confirmRoll');
Route::post('/rooms/{game:slug}/{room:room_code}/peek', [GameRoomController::class, 'peek'])->middleware('throttle:60,1')->name('rooms.peek');
Route::post('/rooms/{game:slug}/{room:room_code}/skip-peek', [GameRoomController::class, 'skipPeek'])->middleware('throttle:60,1')->name('rooms.skipPeek');
Route::post('/rooms/{game:slug}/{room:room_code}/select-accomplice', [GameRoomController::class, 'selectAccomplice'])->middleware('throttle:60,1')->name('rooms.selectAccomplice');
Route::post('/rooms/{game:slug}/{room:room_code}/vote', [GameRoomController::class, 'vote'])->middleware('throttle:60,1')->name('rooms.vote');
Route::post('/rooms/{game:slug}/{room:room_code}/chat', [GameRoomController::class, 'sendMessage'])->middleware('throttle:30,1')->name('rooms.chat');
Route::get('/rooms/{game:slug}/{room:room_code}/messages', [GameRoomController::class, 'getMessages'])->name('rooms.messages');

// Voice chat routes
Route::post('/rooms/{game:slug}/{room:room_code}/voice/signal', [GameRoomController::class, 'sendSignal'])->middleware('throttle:60,1')->name('rooms.voice.signal');
Route::get('/rooms/{game:slug}/{room:room_code}/voice/signals', [GameRoomController::class, 'getSignals'])->name('rooms.voice.signals');
Route::post('/rooms/{game:slug}/{room:room_code}/voice/toggle-mute', [GameRoomController::class, 'toggleMute'])->middleware('throttle:30,1')->name('rooms.voice.toggleMute');
Route::post('/rooms/{game:slug}/{room:room_code}/voice/toggle-video', [GameRoomController::class, 'toggleVideo'])->middleware('throttle:30,1')->name('rooms.voice.toggleVideo');
Route::get('/rooms/{game:slug}/{room:room_code}/voice/status', [GameRoomController::class, 'getVoiceStatus'])->name('rooms.voice.status');

// Trio game routes
Route::post('/rooms/{game:slug}/{room:room_code}/trio/start', [TrioGameController::class, 'start'])->middleware('throttle:20,1')->name('rooms.trio.start');
Route::post('/rooms/{game:slug}/{room:room_code}/trio/reveal-card', [TrioGameController::class, 'revealCard'])->middleware('throttle:60,1')->name('rooms.trio.revealCard');
Route::post('/rooms/{game:slug}/{room:room_code}/trio/claim-trio', [TrioGameController::class, 'claimTrio'])->middleware('throttle:60,1')->name('rooms.trio.claimTrio');
Route::post('/rooms/{game:slug}/{room:room_code}/trio/end-turn', [TrioGameController::class, 'endTurn'])->middleware('throttle:60,1')->name('rooms.trio.endTurn');

// Twenty-Eight game routes
Route::post('/rooms/{game:slug}/{room:room_code}/twenty-eight/start', [TwentyEightGameController::class, 'start'])->middleware('throttle:20,1')->name('rooms.twentyEight.start');
Route::post('/rooms/{game:slug}/{room:room_code}/twenty-eight/place-bid', [TwentyEightGameController::class, 'placeBid'])->middleware('throttle:60,1')->name('rooms.twentyEight.placeBid');
Route::post('/rooms/{game:slug}/{room:room_code}/twenty-eight/select-trump', [TwentyEightGameController::class, 'selectTrump'])->middleware('throttle:60,1')->name('rooms.twentyEight.selectTrump');
Route::post('/rooms/{game:slug}/{room:room_code}/twenty-eight/play-card', [TwentyEightGameController::class, 'playCard'])->middleware('throttle:60,1')->name('rooms.twentyEight.playCard');
Route::post('/rooms/{game:slug}/{room:room_code}/twenty-eight/call-trump', [TwentyEightGameController::class, 'callTrump'])->middleware('throttle:60,1')->name('rooms.twentyEight.callTrump');
Route::post('/rooms/{game:slug}/{room:room_code}/twenty-eight/next-round', [TwentyEightGameController::class, 'startNextRound'])->middleware('throttle:20,1')->name('rooms.twentyEight.nextRound');

// CubeTac game routes (Rubik's Tac Toe)
Route::post('/rooms/{game:slug}/{room:room_code}/cubetac/start', [CubeTacGameController::class, 'start'])->middleware('throttle:20,1')->name('rooms.cubetac.start');
Route::post('/rooms/{game:slug}/{room:room_code}/cubetac/mark', [CubeTacGameController::class, 'mark'])->middleware('throttle:60,1')->name('rooms.cubetac.mark');
Route::post('/rooms/{game:slug}/{room:room_code}/cubetac/rotate', [CubeTacGameController::class, 'rotate'])->middleware('throttle:60,1')->name('rooms.cubetac.rotate');
Route::post('/rooms/{game:slug}/{room:room_code}/cubetac/end-turn', [CubeTacGameController::class, 'endTurn'])->middleware('throttle:60,1')->name('rooms.cubetac.endTurn');
Route::post('/rooms/{game:slug}/{room:room_code}/cubetac/undo-mark', [CubeTacGameController::class, 'undoMark'])->middleware('throttle:60,1')->name('rooms.cubetac.undoMark');
Route::post('/rooms/{game:slug}/{room:room_code}/cubetac/reset', [CubeTacGameController::class, 'reset'])->middleware('throttle:20,1')->name('rooms.cubetac.reset');
Route::get('/play/cubetac/local', [CubeTacGameController::class, 'local'])->name('cubetac.local');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// Backwards compatibility redirect for old room URLs
Route::get('/rooms/{room:room_code}', function (GameRoom $room) {
    return redirect()->route('rooms.show', [$room->game->slug, $room->room_code], 301);
})->name('rooms.show.legacy');

require __DIR__.'/auth.php';
