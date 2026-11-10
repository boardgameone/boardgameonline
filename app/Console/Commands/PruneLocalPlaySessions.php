<?php

namespace App\Console\Commands;

use App\Models\LocalPlaySession;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('local-play:prune {--grace=120 : Minutes without a host sync before a session is deleted}')]
#[Description('Delete CubeTac local phone-join sessions whose host screen has been gone beyond the grace period.')]
class PruneLocalPlaySessions extends Command
{
    public function handle(): int
    {
        $cutoff = now()->subMinutes((int) $this->option('grace'));

        $pruned = LocalPlaySession::query()
            ->where(function ($query) use ($cutoff): void {
                $query->where('last_synced_at', '<', $cutoff)
                    ->orWhere(function ($query) use ($cutoff): void {
                        $query->whereNull('last_synced_at')->where('created_at', '<', $cutoff);
                    });
            })
            ->delete();

        $this->info("{$pruned} local play sessions pruned.");

        return self::SUCCESS;
    }
}
