<?php

namespace Tests\Feature;

use App\Models\LocalPlayAction;
use App\Models\LocalPlaySeat;
use App\Models\LocalPlaySession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CubeTacLocalSessionTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, string>
     */
    private function tokenHeader(string $token): array
    {
        return [LocalPlaySession::TOKEN_HEADER => $token];
    }

    public function test_guest_can_create_a_session(): void
    {
        $response = $this->postJson(route('cubetac.local.sessions.store'), [
            'variant' => 'megaminx',
            'player_count' => 4,
        ]);

        $response->assertCreated();
        $session = LocalPlaySession::query()->firstOrFail();

        $response->assertExactJson([
            'code' => $session->code,
            'host_token' => $session->host_token,
            'join_url' => route('cubetac.local.join', $session),
        ]);
        $this->assertSame(6, strlen($session->code));
        $this->assertSame('megaminx', $session->variant);
        $this->assertSame(4, $session->player_count);
        $this->assertTrue($session->isHostOnline());
    }

    public function test_session_can_be_created_before_setup_is_chosen(): void
    {
        $this->postJson(route('cubetac.local.sessions.store'))->assertCreated();

        $session = LocalPlaySession::query()->firstOrFail();
        $this->assertNull($session->variant);
        $this->assertNull($session->player_count);
    }

    public function test_create_rejects_unknown_variant_and_bad_player_count(): void
    {
        $this->postJson(route('cubetac.local.sessions.store'), ['variant' => 'sphere', 'player_count' => 9])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['variant', 'player_count']);
    }

    public function test_join_page_renders_for_a_known_code(): void
    {
        $session = LocalPlaySession::factory()->create();

        $this->get(route('cubetac.local.join', $session))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Rooms/CubeTac/LocalJoin')
                ->where('code', $session->code));
    }

    public function test_join_page_is_not_found_for_an_unknown_code(): void
    {
        $this->get(route('cubetac.local.join', 'NOPE12'))->assertNotFound();
    }

    public function test_phone_can_claim_a_free_seat(): void
    {
        $session = LocalPlaySession::factory()->create();

        $response = $this->postJson(route('cubetac.local.sessions.claimSeat', $session), [
            'slot' => 1,
            'nickname' => '  Asha  ',
        ]);

        $response->assertCreated()->assertJsonPath('slot', 1);
        $seat = LocalPlaySeat::query()->firstOrFail();
        $this->assertSame('Asha', $seat->nickname);
        $this->assertSame($seat->token, $response->json('seat_token'));
    }

    public function test_taken_seat_is_rejected(): void
    {
        $session = LocalPlaySession::factory()->create();
        LocalPlaySeat::factory()->forSession($session)->slot(1)->create();

        $this->postJson(route('cubetac.local.sessions.claimSeat', $session), [
            'slot' => 1,
            'nickname' => 'Late',
        ])->assertConflict();

        $this->assertSame(1, $session->seats()->count());
    }

    public function test_seat_beyond_player_count_is_rejected(): void
    {
        $session = LocalPlaySession::factory()->create(['player_count' => 2]);

        $this->postJson(route('cubetac.local.sessions.claimSeat', $session), [
            'slot' => 2,
            'nickname' => 'Extra',
        ])->assertUnprocessable();

        $this->postJson(route('cubetac.local.sessions.claimSeat', $session), [
            'slot' => 6,
            'nickname' => 'Extra',
        ])->assertUnprocessable()->assertJsonValidationErrors(['slot']);
    }

    public function test_claim_requires_a_nickname(): void
    {
        $session = LocalPlaySession::factory()->create();

        $this->postJson(route('cubetac.local.sessions.claimSeat', $session), ['slot' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['nickname']);
    }

    public function test_phone_moving_seats_keeps_only_one_seat(): void
    {
        $session = LocalPlaySession::factory()->create();
        $seat = LocalPlaySeat::factory()->forSession($session)->slot(0)->create();

        $this->postJson(
            route('cubetac.local.sessions.claimSeat', $session),
            ['slot' => 2, 'nickname' => 'Mover'],
            $this->tokenHeader($seat->token),
        )->assertCreated();

        $this->assertSame([2], $session->seats()->pluck('slot')->all());
    }

    public function test_phone_can_rename_itself_in_its_own_seat(): void
    {
        $session = LocalPlaySession::factory()->create();
        $seat = LocalPlaySeat::factory()->forSession($session)->slot(0)->create();

        $this->postJson(
            route('cubetac.local.sessions.claimSeat', $session),
            ['slot' => 0, 'nickname' => 'Renamed'],
            $this->tokenHeader($seat->token),
        )->assertOk()->assertJsonPath('seat_token', $seat->token);

        $this->assertSame('Renamed', $seat->fresh()->nickname);
    }

    public function test_phone_can_release_its_seat(): void
    {
        $session = LocalPlaySession::factory()->create();
        $seat = LocalPlaySeat::factory()->forSession($session)->slot(0)->create();
        $other = LocalPlaySeat::factory()->forSession($session)->slot(1)->create();

        $this->deleteJson(
            route('cubetac.local.sessions.releaseSeat', $session),
            [],
            $this->tokenHeader($seat->token),
        )->assertOk();

        $this->assertSame([$other->id], $session->seats()->pluck('id')->all());
    }

    public function test_action_requires_a_seat(): void
    {
        $session = LocalPlaySession::factory()->create();

        $this->postJson(route('cubetac.local.sessions.action', $session), [
            'action' => ['type' => 'END_TURN'],
        ])->assertForbidden();

        $this->assertSame(0, LocalPlayAction::query()->count());
    }

    public function test_seat_token_from_another_session_cannot_act(): void
    {
        $session = LocalPlaySession::factory()->create();
        $foreignSeat = LocalPlaySeat::factory()->create();

        $this->postJson(
            route('cubetac.local.sessions.action', $session),
            ['action' => ['type' => 'END_TURN']],
            $this->tokenHeader($foreignSeat->token),
        )->assertForbidden();
    }

    public function test_action_is_queued_with_the_seats_slot_not_a_client_one(): void
    {
        $session = LocalPlaySession::factory()->create();
        $seat = LocalPlaySeat::factory()->forSession($session)->slot(2)->create();

        $this->postJson(
            route('cubetac.local.sessions.action', $session),
            ['slot' => 0, 'action' => ['type' => 'MARK', 'face' => 1, 'row' => 0, 'col' => 2]],
            $this->tokenHeader($seat->token),
        )->assertCreated();

        $action = LocalPlayAction::query()->firstOrFail();
        $this->assertSame(2, $action->slot);
        $this->assertSame(['type' => 'MARK', 'face' => 1, 'row' => 0, 'col' => 2], $action->payload);
    }

    public function test_malformed_actions_are_rejected(): void
    {
        $session = LocalPlaySession::factory()->create();
        $seat = LocalPlaySeat::factory()->forSession($session)->create();
        $headers = $this->tokenHeader($seat->token);
        $url = route('cubetac.local.sessions.action', $session);

        $this->postJson($url, ['action' => ['type' => 'EXPLODE']], $headers)->assertUnprocessable();
        $this->postJson($url, ['action' => ['type' => 'MARK', 'face' => ['nested']]], $headers)->assertUnprocessable();
        $this->postJson($url, ['action' => ['type' => 'MARK', 'face' => str_repeat('x', 40)]], $headers)->assertUnprocessable();
        $this->postJson($url, [], $headers)->assertUnprocessable();

        $this->assertSame(0, LocalPlayAction::query()->count());
    }

    public function test_sync_is_host_only(): void
    {
        $session = LocalPlaySession::factory()->create();
        $seat = LocalPlaySeat::factory()->forSession($session)->create();
        $url = route('cubetac.local.sessions.sync', $session);

        $this->postJson($url, ['push' => false])->assertForbidden();
        $this->postJson($url, ['push' => false], $this->tokenHeader($seat->token))->assertForbidden();
        $this->postJson($url, ['push' => false], $this->tokenHeader('wrong'))->assertForbidden();
    }

    public function test_sync_push_stores_the_snapshot_and_bumps_the_version(): void
    {
        $session = LocalPlaySession::factory()->settingUp()->hostOffline()->create();

        $response = $this->postJson(
            route('cubetac.local.sessions.sync', $session),
            ['push' => true, 'variant' => 'cube', 'player_count' => 3, 'state' => ['currentTurn' => 1]],
            $this->tokenHeader($session->host_token),
        );

        $response->assertOk()->assertJsonPath('version', 1);
        $session->refresh();
        $this->assertSame('cube', $session->variant);
        $this->assertSame(3, $session->player_count);
        $this->assertSame(['currentTurn' => 1], $session->state);
        $this->assertTrue($session->isHostOnline());
    }

    public function test_sync_without_push_only_refreshes_the_heartbeat(): void
    {
        $session = LocalPlaySession::factory()->hostOffline()->create();

        $this->postJson(
            route('cubetac.local.sessions.sync', $session),
            ['push' => false, 'state' => ['currentTurn' => 5]],
            $this->tokenHeader($session->host_token),
        )->assertOk()->assertJsonPath('version', 1);

        $session->refresh();
        $this->assertSame(['currentTurn' => 0], $session->state);
        $this->assertTrue($session->isHostOnline());
    }

    public function test_sync_returns_seats_and_only_actions_after_the_cursor(): void
    {
        $session = LocalPlaySession::factory()->create();
        LocalPlaySeat::factory()->forSession($session)->slot(1)->create(['nickname' => 'Asha']);
        $first = LocalPlayAction::factory()->forSession($session)->create(['slot' => 1]);
        $second = LocalPlayAction::factory()->forSession($session)->create([
            'slot' => 1,
            'payload' => ['type' => 'UNDO_MARK'],
        ]);
        LocalPlayAction::factory()->create();

        $response = $this->postJson(
            route('cubetac.local.sessions.sync', $session),
            ['push' => false, 'after_id' => $first->id],
            $this->tokenHeader($session->host_token),
        );

        $response->assertOk()
            ->assertJsonPath('seats', [['slot' => 1, 'nickname' => 'Asha']])
            ->assertJsonPath('actions', [
                ['id' => $second->id, 'slot' => 1, 'action' => ['type' => 'UNDO_MARK']],
            ]);
        $this->assertDatabaseMissing('local_play_actions', ['id' => $first->id]);
        $this->assertSame(2, LocalPlayAction::query()->count());
    }

    public function test_sync_drops_seats_beyond_a_smaller_player_count(): void
    {
        $session = LocalPlaySession::factory()->create(['player_count' => 4]);
        LocalPlaySeat::factory()->forSession($session)->slot(1)->create();
        LocalPlaySeat::factory()->forSession($session)->slot(3)->create();

        $this->postJson(
            route('cubetac.local.sessions.sync', $session),
            ['push' => true, 'variant' => 'cube', 'player_count' => 2, 'state' => ['currentTurn' => 0]],
            $this->tokenHeader($session->host_token),
        )->assertOk()->assertJsonCount(1, 'seats');

        $this->assertSame([1], $session->seats()->pluck('slot')->all());
    }

    public function test_sync_keeps_seats_while_the_host_is_back_on_the_setup_picker(): void
    {
        $session = LocalPlaySession::factory()->create();
        LocalPlaySeat::factory()->forSession($session)->slot(2)->create();

        $this->postJson(
            route('cubetac.local.sessions.sync', $session),
            ['push' => true, 'variant' => null, 'player_count' => null, 'state' => null],
            $this->tokenHeader($session->host_token),
        )->assertOk();

        $this->assertNull($session->fresh()->state);
        $this->assertSame(1, $session->seats()->count());
    }

    public function test_sync_rejects_an_oversized_state(): void
    {
        $session = LocalPlaySession::factory()->create();

        $this->postJson(
            route('cubetac.local.sessions.sync', $session),
            ['push' => true, 'state' => ['blob' => str_repeat('x', 40000)]],
            $this->tokenHeader($session->host_token),
        )->assertUnprocessable()->assertJsonValidationErrors(['state']);
    }

    public function test_state_reports_snapshot_seat_and_host_presence(): void
    {
        $session = LocalPlaySession::factory()->create(['state_version' => 7]);
        $seat = LocalPlaySeat::factory()->forSession($session)->slot(2)->create(['nickname' => 'Asha']);

        $this->getJson(
            route('cubetac.local.sessions.state', $session),
            $this->tokenHeader($seat->token),
        )->assertOk()->assertExactJson([
            'version' => 7,
            'variant' => 'cube',
            'player_count' => 3,
            'unchanged' => false,
            'state' => ['currentTurn' => 0],
            'seats' => [['slot' => 2, 'nickname' => 'Asha']],
            'my_slot' => 2,
            'host_online' => true,
        ]);
    }

    public function test_state_omits_the_snapshot_when_the_phone_is_up_to_date(): void
    {
        $session = LocalPlaySession::factory()->create(['state_version' => 7]);

        $this->getJson(route('cubetac.local.sessions.state', [$session, 'version' => 7]))
            ->assertOk()
            ->assertJsonPath('unchanged', true)
            ->assertJsonPath('state', null)
            ->assertJsonPath('my_slot', null);
    }

    public function test_state_reports_host_offline_after_missed_syncs(): void
    {
        $session = LocalPlaySession::factory()->hostOffline()->create();

        $this->getJson(route('cubetac.local.sessions.state', $session))
            ->assertOk()
            ->assertJsonPath('host_online', false);
    }

    public function test_only_the_host_can_close_the_session(): void
    {
        $session = LocalPlaySession::factory()->create();
        LocalPlaySeat::factory()->forSession($session)->create();
        LocalPlayAction::factory()->forSession($session)->create();
        $url = route('cubetac.local.sessions.destroy', $session);

        $this->deleteJson($url)->assertForbidden();
        $this->assertDatabaseHas('local_play_sessions', ['id' => $session->id]);

        $this->deleteJson($url, [], $this->tokenHeader($session->host_token))->assertOk();

        $this->assertDatabaseMissing('local_play_sessions', ['id' => $session->id]);
        $this->assertSame(0, LocalPlaySeat::query()->count());
        $this->assertSame(0, LocalPlayAction::query()->count());
        $this->getJson(route('cubetac.local.sessions.state', $session))->assertNotFound();
    }

    public function test_prune_removes_only_stale_sessions(): void
    {
        $stale = LocalPlaySession::factory()->stale()->create();
        $neverSynced = LocalPlaySession::factory()->stale()->create(['last_synced_at' => null]);
        $recentlyOffline = LocalPlaySession::factory()->hostOffline()->create();
        $live = LocalPlaySession::factory()->create();
        LocalPlaySeat::factory()->forSession($stale)->create();

        $this->artisan('local-play:prune')->assertSuccessful();

        $this->assertDatabaseMissing('local_play_sessions', ['id' => $stale->id]);
        $this->assertDatabaseMissing('local_play_sessions', ['id' => $neverSynced->id]);
        $this->assertDatabaseHas('local_play_sessions', ['id' => $recentlyOffline->id]);
        $this->assertDatabaseHas('local_play_sessions', ['id' => $live->id]);
        $this->assertSame(0, LocalPlaySeat::query()->count());
    }
}
