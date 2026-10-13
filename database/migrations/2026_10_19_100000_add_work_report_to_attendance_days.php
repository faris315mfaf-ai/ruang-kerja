<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Laporan kerja" at check-out (owner decision 13 Oct 2026): the morning
 * check-in collects the work plan (`work_plan`), the afternoon check-out
 * collects what was actually done — same shape, a list of numbered points.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->jsonb('work_report')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropColumn('work_report');
        });
    }
};
