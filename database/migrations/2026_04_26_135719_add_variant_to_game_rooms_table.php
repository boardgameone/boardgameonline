<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_rooms', function (Blueprint $table) {
            $table->string('variant', 32)->nullable()->after('settings');
        });
    }

    public function down(): void
    {
        Schema::table('game_rooms', function (Blueprint $table) {
            $table->dropColumn('variant');
        });
    }
};
