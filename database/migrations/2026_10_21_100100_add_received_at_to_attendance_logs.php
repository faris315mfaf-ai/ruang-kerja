<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance (owner decision 14 Oct 2026): a check-in/out pressed
 * without internet is recorded with the device time in `occurred_at` and
 * carries the flag `offline`; `received_at` is the real server time at which
 * it arrived, kept for HR review. Null for every online log. Written on
 * insert only (the log model stays immutable).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->timestampTz('received_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropColumn('received_at');
        });
    }
};
