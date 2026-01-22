<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatMessage extends Model
{
    protected $fillable = [
        'game_room_id',
        'game_player_id',
        'message',
    ];

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
    public function player(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'game_player_id');
    }
}
