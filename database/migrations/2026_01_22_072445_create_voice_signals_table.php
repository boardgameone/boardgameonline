<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voice_signals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_room_id')->constrained()->onDelete('cascade');
            $table->foreignId('from_player_id')->constrained('game_players')->onDelete('cascade');
            $table->foreignId('to_player_id')->constrained('game_players')->onDelete('cascade');
            $table->enum('type', ['offer', 'answer', 'ice-candidate']);
            $table->json('payload');
            $table->boolean('processed')->default(false);
            $table->timestamps();

            $table->index(['game_room_id', 'to_player_id', 'processed']);
        });

        // Add is_muted column to game_players
        Schema::table('game_players', function (Blueprint $table) {
            $table->boolean('is_muted')->default(true)->after('is_connected');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voice_signals');

        Schema::table('game_players', function (Blueprint $table) {
            $table->dropColumn('is_muted');
        });
    }
};
