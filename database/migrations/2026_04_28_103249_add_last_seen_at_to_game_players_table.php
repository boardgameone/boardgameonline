<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_players', function (Blueprint $table) {
            if (! Schema::hasColumn('game_players', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable()->after('is_connected');
            }
        });
    }

    public function down(): void
    {
        Schema::table('game_players', function (Blueprint $table) {
            if (Schema::hasColumn('game_players', 'last_seen_at')) {
                $table->dropColumn('last_seen_at');
            }
        });
    }
};
