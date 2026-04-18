<?php

namespace App\Console\Commands;

use App\Models\GameRoom;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('rooms:prune {--grace=5 : Minutes of inactivity before an empty room is deleted}')]
#[Description('Delete game rooms that have no connected players and have been inactive beyond the grace period.')]
class PruneEmptyRooms extends Command
{
    public function handle(): int
    {
        $cutoff = now()->subMinutes((int) $this->option('grace'));

        $pruned = 0;

        GameRoom::query()
            ->where('updated_at', '<', $cutoff)
            ->whereDoesntHave('players', fn ($query) => $query->where('is_connected', true))
            ->each(function (GameRoom $room) use (&$pruned): void {
                $room->delete();
                $pruned++;
            });

        $this->info("{$pruned} rooms pruned.");

        return self::SUCCESS;
    }
}
