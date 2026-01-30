<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Game>
 */
class GameFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'slug' => Str::slug($name),
            'name' => ucwords($name),
            'description' => fake()->paragraph(),
            'thumbnail' => null,
            'min_players' => fake()->numberBetween(2, 4),
            'max_players' => fake()->numberBetween(6, 12),
            'estimated_duration_minutes' => fake()->randomElement([15, 30, 45, 60]),
            'rules' => null,
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    public function cheeseThief(): static
    {
        return $this->state(fn (array $attributes) => [
            'slug' => 'cheese-thief',
            'name' => 'Cheese Thief',
            'description' => 'A social deduction game where players try to identify the cheese thief among them.',
            'min_players' => 4,
            'max_players' => 10,
            'estimated_duration_minutes' => 30,
            'is_active' => true,
        ]);
    }

    public function trio(): static
    {
        return $this->state(fn (array $attributes) => [
            'slug' => 'trio',
            'name' => 'Trio',
            'description' => 'A 3-6 player memory and strategy game where players collect matching trios',
            'min_players' => 3,
            'max_players' => 6,
            'estimated_duration_minutes' => 15,
            'is_active' => true,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
