<?php

namespace App\Http\Controllers;

use App\Http\Requests\ClaimLocalPlaySeatRequest;
use App\Http\Requests\CreateLocalPlaySessionRequest;
use App\Http\Requests\SendLocalPlayActionRequest;
use App\Http\Requests\SendLocalPlayViewRequest;
use App\Http\Requests\SyncLocalPlaySessionRequest;
use App\Models\LocalPlayAction;
use App\Models\LocalPlaySeat;
use App\Models\LocalPlaySession;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Relay that lets phones act as controllers for a CubeTac local game.
 *
 * The host screen runs the game rules and owns the state. It pushes snapshots
 * and pulls queued phone actions through `sync`; phones poll `state` and post
 * to `action`. Host and phones identify themselves with the token they were
 * given, sent in the X-Local-Play-Token header.
 */
class CubeTacLocalSessionController extends Controller
{
    public function store(CreateLocalPlaySessionRequest $request): JsonResponse
    {
        $session = LocalPlaySession::query()->create([
            'variant' => $request->validated('variant'),
            'player_count' => $request->validated('player_count'),
            'last_synced_at' => now(),
        ]);

        return response()->json([
            'code' => $session->code,
            'host_token' => $session->host_token,
            'join_url' => route('cubetac.local.join', $session),
        ], 201);
    }

    public function sync(SyncLocalPlaySessionRequest $request, LocalPlaySession $session): JsonResponse
    {
        $this->abortUnlessHost($request, $session);

        $session->last_synced_at = now();

        if ($request->boolean('push')) {
            $playerCount = $request->validated('player_count');
            $session->variant = $request->validated('variant');
            $session->player_count = $playerCount;
            $session->state = $request->validated('state');
            $session->state_version++;

            if ($playerCount !== null) {
                $session->seats()->where('slot', '>=', $playerCount)->delete();
            }
        }

        $session->save();

        $afterId = (int) $request->validated('after_id', 0);
        $session->actions()->where('id', '<=', $afterId)->delete();

        return response()->json([
            'version' => $session->state_version,
            'seats' => $this->seatList($session),
            'view' => Cache::get($session->viewCacheKey()),
            'actions' => $session->actions()
                ->where('id', '>', $afterId)
                ->orderBy('id')
                ->get()
                ->map(fn (LocalPlayAction $action): array => [
                    'id' => $action->id,
                    'slot' => $action->slot,
                    'action' => $action->payload,
                ])
                ->all(),
        ]);
    }

    public function destroy(Request $request, LocalPlaySession $session): JsonResponse
    {
        $this->abortUnlessHost($request, $session);

        Cache::forget($session->viewCacheKey());
        $session->delete();

        return response()->json(['closed' => true]);
    }

    public function join(LocalPlaySession $session): Response
    {
        return Inertia::render('Rooms/CubeTac/LocalJoin', [
            'code' => $session->code,
        ]);
    }

    public function claimSeat(ClaimLocalPlaySeatRequest $request, LocalPlaySession $session): JsonResponse
    {
        $slot = (int) $request->validated('slot');

        if ($session->player_count !== null && $slot >= $session->player_count) {
            return response()->json(['message' => 'That seat does not exist in this game.'], 422);
        }

        $currentSeat = $session->findSeatByToken($this->token($request));
        $occupant = $session->seats()->where('slot', $slot)->first();

        if ($occupant !== null && ! $occupant->is($currentSeat)) {
            return response()->json(['message' => 'That seat is already taken.'], 409);
        }

        $nickname = trim((string) $request->validated('nickname'));

        if ($currentSeat !== null && $currentSeat->slot === $slot) {
            $currentSeat->update(['nickname' => $nickname]);

            return response()->json(['slot' => $slot, 'seat_token' => $currentSeat->token]);
        }

        try {
            $seat = $session->seats()->create([
                'slot' => $slot,
                'nickname' => $nickname,
                'token' => Str::random(40),
            ]);
        } catch (UniqueConstraintViolationException) {
            return response()->json(['message' => 'That seat is already taken.'], 409);
        }

        $currentSeat?->delete();

        return response()->json(['slot' => $seat->slot, 'seat_token' => $seat->token], 201);
    }

    public function releaseSeat(Request $request, LocalPlaySession $session): JsonResponse
    {
        $session->findSeatByToken($this->token($request))?->delete();

        return response()->json(['released' => true]);
    }

    public function state(Request $request, LocalPlaySession $session): JsonResponse
    {
        $seat = $session->findSeatByToken($this->token($request));
        $knownVersion = $request->query('version');
        $isUnchanged = is_numeric($knownVersion) && (int) $knownVersion === $session->state_version;

        return response()->json([
            'version' => $session->state_version,
            'variant' => $session->variant,
            'player_count' => $session->player_count,
            'unchanged' => $isUnchanged,
            'state' => $isUnchanged ? null : $session->state,
            'seats' => $this->seatList($session),
            'my_slot' => $seat?->slot,
            'host_online' => $session->isHostOnline(),
        ]);
    }

    public function action(SendLocalPlayActionRequest $request, LocalPlaySession $session): JsonResponse
    {
        $seat = $session->findSeatByToken($this->token($request));

        if ($seat === null) {
            return response()->json(['message' => 'Take a seat before playing.'], 403);
        }

        $session->actions()->create([
            'slot' => $seat->slot,
            'payload' => $request->validated('action'),
        ]);

        return response()->json(['queued' => true], 201);
    }

    /**
     * A phone reports how it has turned the cube so the host screen can follow.
     * Only the latest angle matters, so it overwrites rather than queues.
     */
    public function view(SendLocalPlayViewRequest $request, LocalPlaySession $session): JsonResponse
    {
        $seat = $session->findSeatByToken($this->token($request));

        if ($seat === null) {
            return response()->json(['message' => 'Take a seat before playing.'], 403);
        }

        Cache::put($session->viewCacheKey(), [
            'slot' => $seat->slot,
            'azimuth' => (float) $request->validated('azimuth'),
            'polar' => (float) $request->validated('polar'),
            'seq' => (int) round(microtime(true) * 1000),
        ], LocalPlaySession::VIEW_TTL_SECONDS);

        return response()->json(['stored' => true]);
    }

    private function token(Request $request): ?string
    {
        return $request->header(LocalPlaySession::TOKEN_HEADER);
    }

    private function abortUnlessHost(Request $request, LocalPlaySession $session): void
    {
        abort_unless($session->isHostToken($this->token($request)), 403, 'Only the host screen can do that.');
    }

    /**
     * @return list<array{slot: int, nickname: string}>
     */
    private function seatList(LocalPlaySession $session): array
    {
        return $session->seats()
            ->orderBy('slot')
            ->get()
            ->map(fn (LocalPlaySeat $seat): array => [
                'slot' => $seat->slot,
                'nickname' => $seat->nickname,
            ])
            ->values()
            ->all();
    }
}
