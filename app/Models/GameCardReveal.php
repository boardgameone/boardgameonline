<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameCardReveal extends Model
{
    protected $fillable = [
        'game_room_id',
        'game_player_id',
        'turn_number',
        'reveal_type',
        'card_value',
        'target_player_id',
        'middle_position',
    ];

    public function gameRoom(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class);
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'game_player_id');
    }

    public function targetPlayer(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'target_player_id');
    }
}
