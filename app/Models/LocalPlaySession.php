<?php

namespace App\Models;

use Database\Factories\LocalPlaySessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A CubeTac local (same-table) game that phones can join as controllers.
 *
 * The host screen stays the source of truth: it pushes state snapshots here
 * and pulls the actions phones have queued. No game rules run on the server.
 */
class LocalPlaySession extends Model
{
    /** @use HasFactory<LocalPlaySessionFactory> */
    use HasFactory;

    public const TOKEN_HEADER = 'X-Local-Play-Token';

    public const HOST_ONLINE_WINDOW_SECONDS = 30;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'host_token',
        'variant',
        'player_count',
        'state',
        'state_version',
        'last_synced_at',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'host_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'player_count' => 'integer',
            'state' => 'array',
            'state_version' => 'integer',
            'last_synced_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (LocalPlaySession $session): void {
            if (empty($session->code)) {
                $session->code = self::generateUniqueCode();
            }
            if (empty($session->host_token)) {
                $session->host_token = Str::random(40);
            }
        });
    }

    public static function generateUniqueCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (self::query()->where('code', $code)->exists());

        return $code;
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    public function isHostToken(?string $token): bool
    {
        return is_string($token) && $token !== '' && hash_equals($this->host_token, $token);
    }

    public function isHostOnline(): bool
    {
        return $this->last_synced_at !== null
            && $this->last_synced_at->gte(now()->subSeconds(self::HOST_ONLINE_WINDOW_SECONDS));
    }

    public function findSeatByToken(?string $token): ?LocalPlaySeat
    {
        if (! is_string($token) || $token === '') {
            return null;
        }

        return $this->seats()->where('token', $token)->first();
    }

    /**
     * @return HasMany<LocalPlaySeat, $this>
     */
    public function seats(): HasMany
    {
        return $this->hasMany(LocalPlaySeat::class);
    }

    /**
     * @return HasMany<LocalPlayAction, $this>
     */
    public function actions(): HasMany
    {
        return $this->hasMany(LocalPlayAction::class);
    }
}
