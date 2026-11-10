<?php

use App\Console\Commands\PruneEmptyRooms;
use App\Console\Commands\PruneLocalPlaySessions;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command(PruneEmptyRooms::class)->everyFiveMinutes();
Schedule::command(PruneLocalPlaySessions::class)->hourly();
