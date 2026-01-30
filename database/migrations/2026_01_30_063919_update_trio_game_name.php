<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('games')
            ->where('slug', 'trio')
            ->update(['name' => 'Trio']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('games')
            ->where('slug', 'trio')
            ->update(['name' => 'TRIO']);
    }
};
