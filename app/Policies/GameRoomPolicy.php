<?php

namespace App\Policies;

use App\Models\GameRoom;
use App\Models\User;

class GameRoomPolicy
{
    public function view(User $user, GameRoom $gameRoom): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function start(User $user, GameRoom $gameRoom): bool
    {
        return $gameRoom->host_user_id === $user->id && $gameRoom->canStart();
    }

    public function join(User $user, GameRoom $gameRoom): bool
    {
        return $gameRoom->isWaiting() && ! $gameRoom->isFull();
    }

    public function leave(User $user, GameRoom $gameRoom): bool
    {
        return $gameRoom->players()->where('user_id', $user->id)->exists();
    }
}
