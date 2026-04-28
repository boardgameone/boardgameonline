<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GamePlayer extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'game_room_id',
        'user_id',
        'session_id',
        'nickname',
        'avatar_color',
        'is_host',
        'is_thief',
        'is_accomplice',
        'die_value',
        'is_connected',
        'last_seen_at',
        'is_muted',
        'is_video_enabled',
        'turn_order',
        'game_data',
        'wins',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_host' => 'boolean',
            'is_thief' => 'boolean',
            'is_accomplice' => 'boolean',
            'is_connected' => 'boolean',
            'last_seen_at' => 'datetime',
            'is_muted' => 'boolean',
            'is_video_enabled' => 'boolean',
            'die_value' => 'integer',
            'turn_order' => 'integer',
            'game_data' => 'array',
            'wins' => 'integer',
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
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<GameAction, $this>
     */
    public function actions(): HasMany
    {
        return $this->hasMany(GameAction::class);
    }

    /**
     * @return HasMany<GameVote, $this>
     */
    public function votesCast(): HasMany
    {
        return $this->hasMany(GameVote::class, 'voter_id');
    }

    /**
     * @return HasMany<GameVote, $this>
     */
    public function votesReceived(): HasMany
    {
        return $this->hasMany(GameVote::class, 'voted_for_id');
    }

    /**
     * Check if this player has confirmed seeing their die roll.
     */
    public function hasConfirmedRoll(): bool
    {
        return ($this->game_data['confirmed_roll'] ?? false) === true;
    }

    /**
     * Mark this player as having confirmed their die roll.
     */
    public function confirmRoll(): void
    {
        $this->update([
            'game_data' => array_merge($this->game_data ?? [], ['confirmed_roll' => true]),
        ]);
    }

    /**
     * Check if this player has cast a vote.
     */
    public function hasVoted(): bool
    {
        return ($this->game_data['has_voted'] ?? false) === true;
    }

    /**
     * Mark this player as having voted.
     */
    public function markVoted(): void
    {
        $this->update([
            'game_data' => array_merge($this->game_data ?? [], ['has_voted' => true]),
        ]);
    }

    /**
     * Map of player_id => die_value for players this mouse has peeked at.
     *
     * @return array<int, int>
     */
    public function getPeekedPlayers(): array
    {
        return $this->game_data['peeked_players'] ?? [];
    }

    /**
     * Has this mouse already used their peek for the given night hour?
     */
    public function hasPeekedAtHour(int $hour): bool
    {
        return in_array($hour, $this->game_data['peeked_hours'] ?? [], true);
    }

    /**
     * Record a peek result and the hour in which it was taken.
     */
    public function recordPeek(int $playerId, int $dieValue, int $hour): void
    {
        $peeked = $this->game_data['peeked_players'] ?? [];
        $peeked[$playerId] = $dieValue;

        $hours = $this->game_data['peeked_hours'] ?? [];
        if (! in_array($hour, $hours, true)) {
            $hours[] = $hour;
        }

        $this->update([
            'game_data' => array_merge($this->game_data ?? [], [
                'peeked_players' => $peeked,
                'peeked_hours' => $hours,
            ]),
        ]);
    }
}
