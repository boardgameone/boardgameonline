<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class GameRoom extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'game_id',
        'host_user_id',
        'room_code',
        'name',
        'status',
        'current_hour',
        'thief_player_id',
        'accomplice_player_id',
        'winner',
        'settings',
        'started_at',
        'ended_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'current_hour' => 'integer',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (GameRoom $room) {
            if (empty($room->room_code)) {
                $room->room_code = self::generateUniqueRoomCode();
            }
            if (empty($room->status)) {
                $room->status = 'waiting';
            }
        });
    }

    public static function generateUniqueRoomCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (self::where('room_code', $code)->exists());

        return $code;
    }

    /**
     * @return BelongsTo<Game, $this>
     */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    /**
     * @return HasMany<GamePlayer, $this>
     */
    public function players(): HasMany
    {
        return $this->hasMany(GamePlayer::class);
    }

    /**
     * @return HasMany<GamePlayer, $this>
     */
    public function connectedPlayers(): HasMany
    {
        return $this->hasMany(GamePlayer::class)->where('is_connected', true);
    }

    /**
     * @return BelongsTo<GamePlayer, $this>
     */
    public function thief(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'thief_player_id');
    }

    /**
     * @return BelongsTo<GamePlayer, $this>
     */
    public function accomplice(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'accomplice_player_id');
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
    public function peeks(): HasMany
    {
        return $this->hasMany(GamePeek::class);
    }

    /**
     * @return HasMany<GameVote, $this>
     */
    public function votes(): HasMany
    {
        return $this->hasMany(GameVote::class);
    }

    /**
     * @return HasMany<ChatMessage, $this>
     */
    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function isWaiting(): bool
    {
        return $this->status === 'waiting';
    }

    public function isPlaying(): bool
    {
        return $this->status === 'playing';
    }

    public function isFinished(): bool
    {
        return $this->status === 'finished';
    }

    public function isFull(): bool
    {
        if (! $this->game) {
            return false;
        }

        return $this->connectedPlayers()->count() >= $this->game->max_players;
    }

    public function canStart(): bool
    {
        if (! $this->game) {
            return false;
        }

        return $this->isWaiting() && $this->connectedPlayers()->count() >= $this->game->min_players;
    }

    /**
     * Get players whose die value matches the given hour.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, GamePlayer>
     */
    public function playersAtHour(int $hour): \Illuminate\Database\Eloquent\Collection
    {
        return $this->connectedPlayers()->where('die_value', $hour)->get();
    }

    /**
     * Check if a player woke up alone at the given hour.
     */
    public function playerWokeUpAlone(int $hour): bool
    {
        return $this->playersAtHour($hour)->count() === 1;
    }

    /**
     * Check if all connected players have confirmed their die rolls.
     */
    public function allPlayersConfirmedRoll(): bool
    {
        return $this->connectedPlayers->every(fn (GamePlayer $player) => $player->hasConfirmedRoll());
    }

    /**
     * Check if the current night hour phase is complete.
     * A night hour is complete when:
     * - No one woke up (0 players), or
     * - Multiple players woke up (2+), or
     * - Exactly 1 player woke up and has completed their action.
     */
    public function currentHourComplete(): bool
    {
        $hour = $this->current_hour;
        if ($hour < 1 || $hour > 6) {
            return true;
        }

        $awakePlayers = $this->playersAtHour($hour);
        $count = $awakePlayers->count();

        // No one or multiple players woke up - auto-complete
        if ($count === 0 || $count > 1) {
            return true;
        }

        // Exactly one player - check if they've completed their action
        return $awakePlayers->first()->hasCompletedHour($hour);
    }

    /**
     * Check if all connected players have cast their votes.
     */
    public function allVotesCast(): bool
    {
        return $this->connectedPlayers->every(fn (GamePlayer $player) => $player->hasVoted());
    }

    /**
     * Calculate the game results after voting.
     *
     * @return array{winner: string, vote_counts: array<int, int>, most_voted_player_id: int}
     */
    public function calculateResults(): array
    {
        // Count votes for each player
        $voteCounts = [];
        foreach ($this->votes as $vote) {
            $votedForId = $vote->voted_for_id;
            $voteCounts[$votedForId] = ($voteCounts[$votedForId] ?? 0) + 1;
        }

        // Find the player with the most votes
        $maxVotes = max($voteCounts) ?: 0;
        $mostVotedPlayerIds = array_keys(array_filter($voteCounts, fn ($count) => $count === $maxVotes));

        // In case of a tie, thief wins (innocent mice lose)
        $mostVotedPlayerId = $mostVotedPlayerIds[0];

        // Check if the thief was caught
        $thiefCaught = $this->thief_player_id === $mostVotedPlayerId && count($mostVotedPlayerIds) === 1;
        $winner = $thiefCaught ? 'mice' : 'thief';

        return [
            'winner' => $winner,
            'vote_counts' => $voteCounts,
            'most_voted_player_id' => $mostVotedPlayerId,
        ];
    }

    /**
     * Check if cheese has been stolen (any player peeked at the thief).
     */
    public function isCheeseStolen(): bool
    {
        return $this->connectedPlayers()->where('has_stolen_cheese', true)->exists();
    }
}
