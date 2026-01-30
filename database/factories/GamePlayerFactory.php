<?php

namespace Database\Factories;

use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GamePlayer>
 */
class GamePlayerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

        return [
            'game_room_id' => GameRoom::factory(),
            'user_id' => User::factory(),
            'session_id' => Str::random(40),
            'nickname' => fake()->firstName(),
            'avatar_color' => $colors[array_rand($colors)],
            'is_host' => false,
            'is_thief' => false,
            'is_accomplice' => false,
            'die_value' => null,
            'has_stolen_cheese' => false,
            'is_connected' => true,
            'is_muted' => true,
            'is_video_enabled' => false,
            'turn_order' => null,
            'game_data' => null,
        ];
    }

    public function host(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_host' => true,
        ]);
    }

    public function thief(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_thief' => true,
        ]);
    }

    public function accomplice(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_accomplice' => true,
        ]);
    }

    public function disconnected(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_connected' => false,
        ]);
    }

    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user->id,
            'nickname' => $user->name,
        ]);
    }

    public function forRoom(GameRoom $room): static
    {
        return $this->state(fn (array $attributes) => [
            'game_room_id' => $room->id,
        ]);
    }

    public function guest(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => null,
        ]);
    }
}
