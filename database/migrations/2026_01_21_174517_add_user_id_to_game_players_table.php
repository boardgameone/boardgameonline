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
        Schema::table('game_players', function (Blueprint $table) {
            if (! Schema::hasColumn('game_players', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('game_room_id')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('game_players', 'turn_order')) {
                $table->tinyInteger('turn_order')->unsigned()->nullable()->after('is_connected');
            }
            if (! Schema::hasColumn('game_players', 'game_data')) {
                $table->json('game_data')->nullable()->after('turn_order');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('game_players', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['user_id', 'turn_order', 'game_data']);
        });
    }
};
