<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Rapat video RuangKerja (docs/fitur/rapat-kalender.md §6a, LiveKit): platform
 * `video` for meetings and the attendance recorded from LiveKit webhooks
 * (docs/DATABASE.md §7 meeting_attendances). One row per participant session
 * (a LiveKit participant SID); rejoining after a drop adds a new row.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE meetings DROP CONSTRAINT meetings_platform_check');
        DB::statement("ALTER TABLE meetings ADD CONSTRAINT meetings_platform_check CHECK (platform IN ('meet', 'zoom', 'room', 'client', 'video'))");

        Schema::create('meeting_attendances', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('meeting_id')->constrained()->cascadeOnDelete();
            // Office date of the occurrence (series: one room per date).
            $table->date('occurrence_date');
            $table->foreignUlid('user_id')->nullable()->constrained()->nullOnDelete();
            // LiveKit room name ("rk-{meeting}-{yyyymmdd}") and participant session id.
            $table->string('room', 64);
            $table->string('participant_sid', 64)->unique();
            $table->timestampTz('joined_at');
            $table->timestampTz('left_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->timestampsTz();

            $table->index(['meeting_id', 'occurrence_date']);
            $table->index('user_id');
        });

        DB::statement('ALTER TABLE meeting_attendances ADD CONSTRAINT meeting_attendances_left_check CHECK (left_at IS NULL OR left_at >= joined_at)');
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_attendances');

        // Video meetings fall back to "Google Meet" without a link.
        DB::statement("UPDATE meetings SET platform = 'meet' WHERE platform = 'video'");
        DB::statement('ALTER TABLE meetings DROP CONSTRAINT meetings_platform_check');
        DB::statement("ALTER TABLE meetings ADD CONSTRAINT meetings_platform_check CHECK (platform IN ('meet', 'zoom', 'room', 'client'))");
    }
};
