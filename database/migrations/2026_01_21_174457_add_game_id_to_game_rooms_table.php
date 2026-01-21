<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('game_rooms', function (Blueprint $table) {
            if (! Schema::hasColumn('game_rooms', 'game_id')) {
                $table->foreignId('game_id')->nullable()->after('id')->constrained('games')->nullOnDelete();
            }
            if (! Schema::hasColumn('game_rooms', 'host_user_id')) {
                $table->foreignId('host_user_id')->nullable()->after('game_id')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('game_rooms', 'name')) {
                $table->string('name')->nullable()->after('room_code');
            }
            if (! Schema::hasColumn('game_rooms', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('settings');
            }
            if (! Schema::hasColumn('game_rooms', 'ended_at')) {
                $table->timestamp('ended_at')->nullable()->after('started_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('game_rooms', function (Blueprint $table) {
            $table->dropForeign(['game_id']);
            $table->dropForeign(['host_user_id']);
            $table->dropColumn(['game_id', 'host_user_id', 'name', 'started_at', 'ended_at']);
        });
    }
};
