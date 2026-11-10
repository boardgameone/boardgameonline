<?php

namespace Database\Factories;

use App\Models\LocalPlayAction;
use App\Models\LocalPlaySession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LocalPlayAction>
 */
class LocalPlayActionFactory extends Factory
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
            'payload' => ['type' => 'END_TURN'],
        ];
    }

    public function forSession(LocalPlaySession $session): static
    {
        return $this->state(fn (array $attributes) => [
            'local_play_session_id' => $session->id,
        ]);
    }
}
