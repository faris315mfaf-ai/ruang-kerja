<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Rencana kerja hari ini" filled at check-in (owner decision 8 Oct 2026):
 * the plan rides along on the day and is copied into the management
 * WhatsApp message (docs/fitur/absensi-whatsapp.md).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->text('work_plan')->nullable()->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropColumn('work_plan');
        });
    }
};
