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
        Schema::create('game_card_reveals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_player_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('turn_number');
            $table->string('reveal_type');
            $table->tinyInteger('card_value')->unsigned();
            $table->foreignId('target_player_id')->nullable()->constrained('game_players');
            $table->integer('middle_position')->nullable();
            $table->timestamps();

            $table->index(['game_room_id', 'turn_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_card_reveals');
    }
};
