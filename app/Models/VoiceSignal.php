<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoiceSignal extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'game_room_id',
        'from_player_id',
        'to_player_id',
        'type',
        'payload',
        'processed',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'processed' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<GameRoom, $this>
     */
    public function gameRoom(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class);
    }

    /**
     * @return BelongsTo<GamePlayer, $this>
     */
    public function fromPlayer(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'from_player_id');
    }

    /**
     * @return BelongsTo<GamePlayer, $this>
     */
    public function toPlayer(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'to_player_id');
    }
}
