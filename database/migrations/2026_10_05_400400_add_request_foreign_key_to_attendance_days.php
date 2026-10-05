<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * attendance_days.request_id (Sprint 2, created before `requests` existed) → requests.
     */
    public function up(): void
    {
        // Links to requests that no longer exist (e.g. after a rollback) cannot be kept.
        DB::table('attendance_days')
            ->whereNotNull('request_id')
            ->whereNotIn('request_id', DB::table('requests')->select('id'))
            ->update(['request_id' => null]);

        Schema::table('attendance_days', function (Blueprint $table) {
            $table->foreign('request_id')->references('id')->on('requests')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropForeign(['request_id']);
        });
    }
};
