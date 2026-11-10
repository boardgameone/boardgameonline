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
        Schema::create('local_play_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('code', 6)->unique();
            $table->string('host_token', 64);
            $table->string('variant', 20)->nullable();
            $table->unsignedTinyInteger('player_count')->nullable();
            $table->json('state')->nullable();
            $table->unsignedInteger('state_version')->default(0);
            $table->timestamp('last_synced_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('local_play_seats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('local_play_session_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('slot');
            $table->string('nickname', 20);
            $table->string('token', 64);
            $table->timestamps();

            $table->unique(['local_play_session_id', 'slot']);
            $table->index(['local_play_session_id', 'token']);
        });

        Schema::create('local_play_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('local_play_session_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('slot');
            $table->json('payload');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('local_play_actions');
        Schema::dropIfExists('local_play_seats');
        Schema::dropIfExists('local_play_sessions');
    }
};
