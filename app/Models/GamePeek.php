<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GamePeek extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'game_room_id',
        'peeker_id',
        'peeked_at_id',
        'hour',
        'saw_thief',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'hour' => 'integer',
            'saw_thief' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<GameRoom, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
    }

    /**
     * @return BelongsTo<GamePlayer, $this>
     */
    public function peeker(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'peeker_id');
    }

    /**
     * @return BelongsTo<GamePlayer, $this>
     */
    public function peekedAt(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'peeked_at_id');
    }
}
