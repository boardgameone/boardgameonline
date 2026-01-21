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
        if (! Schema::hasTable('game_rooms')) {
            Schema::create('game_rooms', function (Blueprint $table) {
                $table->id();
                $table->string('room_code')->unique()->index();
                $table->string('status')->default('waiting')->index();
                $table->tinyInteger('current_hour')->unsigned()->default(0);
                $table->foreignId('thief_player_id')->nullable();
                $table->foreignId('accomplice_player_id')->nullable();
                $table->string('winner')->nullable();
                $table->json('settings')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('game_players')) {
            Schema::create('game_players', function (Blueprint $table) {
                $table->id();
                $table->foreignId('game_room_id')->constrained('game_rooms')->cascadeOnDelete();
                $table->string('session_id');
                $table->string('nickname');
                $table->string('avatar_color');
                $table->boolean('is_host')->default(false);
                $table->boolean('is_thief')->default(false);
                $table->boolean('is_accomplice')->default(false);
                $table->tinyInteger('die_value')->unsigned()->nullable();
                $table->boolean('has_stolen_cheese')->default(false);
                $table->boolean('is_connected')->default(true)->index();
                $table->timestamps();

                $table->index(['game_room_id', 'session_id']);
            });
        }

        Schema::table('game_rooms', function (Blueprint $table) {
            if (! Schema::hasColumn('game_rooms', 'thief_player_id')) {
                return;
            }
            if (Schema::getColumnType('game_rooms', 'thief_player_id') !== 'bigint') {
                return;
            }
            try {
                $table->foreign('thief_player_id')->references('id')->on('game_players')->nullOnDelete();
                $table->foreign('accomplice_player_id')->references('id')->on('game_players')->nullOnDelete();
            } catch (\Exception $e) {
                // Foreign keys may already exist
            }
        });

        if (! Schema::hasTable('game_actions')) {
            Schema::create('game_actions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('game_room_id')->constrained('game_rooms')->cascadeOnDelete();
                $table->foreignId('game_player_id')->nullable()->constrained('game_players')->nullOnDelete();
                $table->string('action_type');
                $table->json('payload')->nullable();
                $table->timestamps();

                $table->index(['game_room_id', 'action_type']);
            });
        }

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

        if (! Schema::hasTable('game_votes')) {
            Schema::create('game_votes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('game_room_id')->constrained('game_rooms')->cascadeOnDelete();
                $table->foreignId('voter_id')->constrained('game_players')->cascadeOnDelete();
                $table->foreignId('voted_for_id')->constrained('game_players')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['game_room_id', 'voter_id']);
                $table->index(['game_room_id', 'voted_for_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_votes');
        Schema::dropIfExists('game_peeks');
        Schema::dropIfExists('game_actions');
        Schema::dropIfExists('game_players');
        Schema::dropIfExists('game_rooms');
    }
};
