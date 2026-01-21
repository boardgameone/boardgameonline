<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameVote extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'game_room_id',
        'voter_id',
        'voted_for_id',
    ];

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
    public function voter(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'voter_id');
    }

    /**
     * @return BelongsTo<GamePlayer, $this>
     */
    public function votedFor(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'voted_for_id');
    }
}
