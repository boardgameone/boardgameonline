<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
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
        'is_public',
        'current_hour',
        'hour_started_at',
        'thief_player_id',
        'accomplice_player_id',
        'cheese_stolen_at_hour',
        'winner',
        'settings',
        'variant',
        'started_at',
        'ended_at',
        'games_played',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'is_public' => 'boolean',
            'current_hour' => 'integer',
            'cheese_stolen_at_hour' => 'integer',
            'hour_started_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'games_played' => 'integer',
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

    /**
     * @return HasMany<GameCardReveal, $this>
     */
    public function cardReveals(): HasMany
    {
        return $this->hasMany(GameCardReveal::class);
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
     * @return Collection<int, GamePlayer>
     */
    public function playersAtHour(int $hour): Collection
    {
        return $this->connectedPlayers()->where('die_value', $hour)->get();
    }

    /**
     * Did exactly one mouse wake up at this hour?
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
     * Get the fixed timer duration (in seconds) for every night hour.
     * Each of the 6 hours runs for the same duration regardless of how many
     * mice are awake — like a narrator counting through the night.
     */
    public function getHourTimerDuration(): int
    {
        return (int) config('games.cheese_thief.night_hour_timer_seconds', 12);
    }

    /**
     * Check if the hour timer has expired.
     */
    public function isHourTimerExpired(): bool
    {
        if ($this->current_hour < 1 || $this->current_hour > 6) {
            return false;
        }

        if (! $this->hour_started_at) {
            return false;
        }

        return $this->hour_started_at->diffInSeconds(now()) >= $this->getHourTimerDuration();
    }

    /**
     * Check if the current night hour phase is complete.
     * Hours always run for the full timer duration — no early-completion path.
     */
    public function currentHourComplete(): bool
    {
        if ($this->current_hour < 1 || $this->current_hour > 6) {
            return true;
        }

        return $this->isHourTimerExpired();
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
     * Check if the cheese has been stolen (set when night reaches the thief's hour).
     */
    public function isCheeseStolen(): bool
    {
        return ! is_null($this->cheese_stolen_at_hour);
    }

    /**
     * Get the thief's die value (the hour at which the cheese can/will be stolen).
     */
    public function thiefDieValue(): ?int
    {
        if (! $this->thief_player_id) {
            return null;
        }

        $thief = $this->players->firstWhere('id', $this->thief_player_id)
            ?? $this->players()->find($this->thief_player_id);

        return $thief?->die_value;
    }
}
