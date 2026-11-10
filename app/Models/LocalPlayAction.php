<?php

namespace App\Models;

use Database\Factories\LocalPlayActionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocalPlayAction extends Model
{
    /** @use HasFactory<LocalPlayActionFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'local_play_session_id',
        'slot',
        'payload',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'slot' => 'integer',
            'payload' => 'array',
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
