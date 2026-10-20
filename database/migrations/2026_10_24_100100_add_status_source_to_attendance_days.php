<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Absen pegawai (keputusan pemilik 20 Okt 2026): HR sets a day's status by
 * hand. `status_source = manual` marks such a row so closing the day never
 * overwrites it; a real check-in/out or an approved request clears it again
 * (docs/fitur/absensi-gaji.md).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->string('status_source', 10)->nullable();
            $table->foreignUlid('status_set_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('status_set_at')->nullable();
        });

        DB::statement("ALTER TABLE attendance_days ADD CONSTRAINT attendance_days_status_source_check CHECK (status_source IS NULL OR status_source = 'manual')");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE attendance_days DROP CONSTRAINT IF EXISTS attendance_days_status_source_check');

        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropConstrainedForeignId('status_set_by');
            $table->dropColumn(['status_source', 'status_set_at']);
        });
    }
};
