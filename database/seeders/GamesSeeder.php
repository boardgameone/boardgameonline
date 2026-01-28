<?php

namespace Database\Seeders;

use App\Models\Game;
use Illuminate\Database\Seeder;

class GamesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Game::updateOrCreate(
            ['slug' => 'cheese-thief'],
            [
                'name' => 'Cheese Thief',
                'description' => 'A social deduction game where players try to identify the cheese thief among them. Use your detective skills to catch the thief before all the cheese is stolen!',
                'thumbnail' => null,
                'min_players' => 4,
                'max_players' => 10,
                'estimated_duration_minutes' => 30,
                'rules' => [
                    'objective' => 'Villagers must identify and vote out the Cheese Thief. The Thief must avoid detection while stealing cheese.',
                    'roles' => [
                        'Thief' => 'Steals cheese each night. Wins if not caught.',
                        'Accomplice' => 'Helps the thief. Knows who the thief is.',
                        'Villager' => 'Must vote to catch the thief.',
                    ],
                    'phases' => [
                        'Night' => 'Players peek at each other\'s dice rolls.',
                        'Day' => 'Discussion and voting phase.',
                    ],
                ],
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        Game::updateOrCreate(
            ['slug' => 'trio'],
            [
                'name' => 'TRIO',
                'description' => 'A 3-6 player memory and strategy game where players collect matching trios by revealing cards from hands and a middle grid. First to collect 3 trios wins!',
                'thumbnail' => null,
                'min_players' => 3,
                'max_players' => 6,
                'estimated_duration_minutes' => 15,
                'rules' => [
                    'objective' => 'Be the first player to collect 3 trios (sets of 3 matching cards).',
                    'setup' => 'Cards are dealt to player hands (sorted) and a face-down middle grid.',
                    'turn' => 'Reveal cards by asking players for highest/lowest card or flipping middle cards. Turn continues while cards match, ends when 2 cards differ.',
                    'trio' => 'Collect 3 matching revealed cards in one turn to claim a trio.',
                ],
                'is_active' => true,
                'sort_order' => 2,
            ]
        );
    }
}
