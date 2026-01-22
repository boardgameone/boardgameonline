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
        'has_stolen_cheese',
        'is_connected',
        'is_muted',
        'turn_order',
        'game_data',
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
            'has_stolen_cheese' => 'boolean',
            'is_connected' => 'boolean',
            'is_muted' => 'boolean',
            'die_value' => 'integer',
            'turn_order' => 'integer',
            'game_data' => 'array',
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
     * @return HasMany<GamePeek, $this>
     */
    public function peeksPerformed(): HasMany
    {
        return $this->hasMany(GamePeek::class, 'peeker_id');
    }

    /**
     * @return HasMany<GamePeek, $this>
     */
    public function peeksReceived(): HasMany
    {
        return $this->hasMany(GamePeek::class, 'peeked_at_id');
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
     * Check if this player has completed their action for a given night hour.
     */
    public function hasCompletedHour(int $hour): bool
    {
        return in_array($hour, $this->game_data['completed_hours'] ?? []);
    }

    /**
     * Mark a night hour as completed for this player.
     */
    public function completeHour(int $hour): void
    {
        $completedHours = $this->game_data['completed_hours'] ?? [];
        if (! in_array($hour, $completedHours)) {
            $completedHours[] = $hour;
            $this->update([
                'game_data' => array_merge($this->game_data ?? [], ['completed_hours' => $completedHours]),
            ]);
        }
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
     * Get the IDs of players this player has peeked at (and their die values).
     *
     * @return array<int, int> player_id => die_value
     */
    public function getPeekedPlayers(): array
    {
        return $this->game_data['peeked_players'] ?? [];
    }

    /**
     * Record that this player peeked at another player's die.
     */
    public function recordPeek(int $playerId, int $dieValue): void
    {
        $peekedPlayers = $this->game_data['peeked_players'] ?? [];
        $peekedPlayers[$playerId] = $dieValue;
        $this->update([
            'game_data' => array_merge($this->game_data ?? [], ['peeked_players' => $peekedPlayers]),
        ]);
    }
}
