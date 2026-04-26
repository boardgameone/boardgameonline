<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_rooms', function (Blueprint $table) {
            if (! Schema::hasColumn('game_rooms', 'cheese_stolen_at_hour')) {
                $table->tinyInteger('cheese_stolen_at_hour')->unsigned()->nullable()->after('accomplice_player_id');
            }
        });

        Schema::table('game_players', function (Blueprint $table) {
            if (Schema::hasColumn('game_players', 'has_stolen_cheese')) {
                $table->dropColumn('has_stolen_cheese');
            }
        });

        Schema::dropIfExists('game_peeks');
    }

    public function down(): void
    {
        Schema::table('game_rooms', function (Blueprint $table) {
            if (Schema::hasColumn('game_rooms', 'cheese_stolen_at_hour')) {
                $table->dropColumn('cheese_stolen_at_hour');
            }
        });

        Schema::table('game_players', function (Blueprint $table) {
            if (! Schema::hasColumn('game_players', 'has_stolen_cheese')) {
                $table->boolean('has_stolen_cheese')->default(false)->after('die_value');
            }
        });

        if (! Schema::hasTable('game_peeks')) {
            Schema::create('game_peeks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('game_room_id')->constrained('game_rooms')->cascadeOnDelete();
                $table->foreignId('peeker_id')->constrained('game_players')->cascadeOnDelete();
                $table->foreignId('peeked_at_id')->constrained('game_players')->cascadeOnDelete();
                $table->tinyInteger('hour')->unsigned();
                $table->boolean('saw_thief')->default(false);
                $table->timestamps();

                $table->index(['game_room_id', 'hour']);
            });
        }
    }
};
