<?php

namespace Database\Factories;

use App\Models\LocalPlaySession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<LocalPlaySession>
 */
class LocalPlaySessionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => strtoupper(Str::random(6)),
            'host_token' => Str::random(40),
            'variant' => 'cube',
            'player_count' => 3,
            'state' => ['currentTurn' => 0],
            'state_version' => 1,
            'last_synced_at' => now(),
        ];
    }

    public function settingUp(): static
    {
        return $this->state(fn (array $attributes) => [
            'variant' => null,
            'player_count' => null,
            'state' => null,
            'state_version' => 0,
        ]);
    }

    public function hostOffline(): static
    {
        return $this->state(fn (array $attributes) => [
            'last_synced_at' => now()->subMinutes(5),
        ]);
    }

    public function stale(): static
    {
        return $this->state(fn (array $attributes) => [
            'last_synced_at' => now()->subHours(3),
            'created_at' => now()->subHours(3),
        ]);
    }
}
