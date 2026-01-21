<?php

namespace Database\Factories;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GameRoom>
 */
class GameRoomFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'game_id' => Game::factory(),
            'host_user_id' => User::factory(),
            'room_code' => strtoupper(Str::random(6)),
            'name' => fake()->optional()->words(3, true),
            'status' => 'waiting',
            'current_hour' => 0,
            'settings' => null,
        ];
    }

    public function playing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'playing',
            'started_at' => now(),
        ]);
    }

    public function finished(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'finished',
            'started_at' => now()->subHour(),
            'ended_at' => now(),
        ]);
    }

    public function withHost(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'host_user_id' => $user->id,
        ]);
    }

    public function forGame(Game $game): static
    {
        return $this->state(fn (array $attributes) => [
            'game_id' => $game->id,
        ]);
    }
}
