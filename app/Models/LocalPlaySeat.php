<?php

namespace App\Models;

use Database\Factories\LocalPlaySeatFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocalPlaySeat extends Model
{
    /** @use HasFactory<LocalPlaySeatFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'local_play_session_id',
        'slot',
        'nickname',
        'token',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'slot' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<LocalPlaySession, $this>
     */
    public function session(): BelongsTo
    {
        return $this->belongsTo(LocalPlaySession::class, 'local_play_session_id');
    }
}
