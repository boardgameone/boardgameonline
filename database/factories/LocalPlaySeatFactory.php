<?php

namespace Database\Factories;

use App\Models\LocalPlaySeat;
use App\Models\LocalPlaySession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<LocalPlaySeat>
 */
class LocalPlaySeatFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'local_play_session_id' => LocalPlaySession::factory(),
            'slot' => 0,
            'nickname' => fake()->firstName(),
            'token' => Str::random(40),
        ];
    }

    public function forSession(LocalPlaySession $session): static
    {
        return $this->state(fn (array $attributes) => [
            'local_play_session_id' => $session->id,
        ]);
    }

    public function slot(int $slot): static
    {
        return $this->state(fn (array $attributes) => [
            'slot' => $slot,
        ]);
    }
}
