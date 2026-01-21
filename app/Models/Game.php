<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'slug',
        'name',
        'description',
        'thumbnail',
        'min_players',
        'max_players',
        'estimated_duration_minutes',
        'rules',
        'is_active',
        'sort_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rules' => 'array',
            'is_active' => 'boolean',
            'min_players' => 'integer',
            'max_players' => 'integer',
            'estimated_duration_minutes' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return HasMany<GameRoom, $this>
     */
    public function rooms(): HasMany
    {
        return $this->hasMany(GameRoom::class);
    }

    /**
     * @return HasMany<GameRoom, $this>
     */
    public function activeRooms(): HasMany
    {
        return $this->hasMany(GameRoom::class)->whereIn('status', ['waiting', 'playing']);
    }
}
