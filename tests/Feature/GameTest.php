<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameTest extends TestCase
{
    use RefreshDatabase;

    public function test_games_index_page_can_be_rendered(): void
    {
        $user = User::factory()->create();
        Game::factory()->count(3)->create();

        $response = $this->actingAs($user)->get(route('games.index'));

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Games/Index')
            ->has('games', 3)
        );
    }

    public function test_games_index_only_shows_active_games(): void
    {
        $user = User::factory()->create();
        Game::factory()->count(2)->create();
        Game::factory()->inactive()->create();

        $response = $this->actingAs($user)->get(route('games.index'));

        $response->assertInertia(fn ($page) => $page
            ->has('games', 2)
        );
    }

    public function test_game_show_page_can_be_rendered(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->create();

        $response = $this->actingAs($user)->get(route('games.show', $game->slug));

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Games/Show')
            ->has('game')
            ->where('game.id', $game->id)
        );
    }

    public function test_inactive_game_returns_404(): void
    {
        $user = User::factory()->create();
        $game = Game::factory()->inactive()->create();

        $response = $this->actingAs($user)->get(route('games.show', $game->slug));

        $response->assertStatus(404);
    }

    public function test_welcome_page_shows_featured_games(): void
    {
        Game::factory()->count(3)->create();

        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Welcome')
            ->has('featuredGames', 3)
        );
    }
}
