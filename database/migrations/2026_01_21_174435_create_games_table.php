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
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description');
            $table->string('thumbnail')->nullable();
            $table->tinyInteger('min_players')->unsigned();
            $table->tinyInteger('max_players')->unsigned();
            $table->integer('estimated_duration_minutes')->unsigned()->nullable();
            $table->json('rules')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->unsigned()->default(0);
            $table->timestamps();

            $table->index('is_active');
            $table->index('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('games');
    }
};
