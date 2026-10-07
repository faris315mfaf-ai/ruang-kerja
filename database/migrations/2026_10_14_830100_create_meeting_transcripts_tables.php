<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Notulen otomatis (Video RuangKerja, tahap 1; docs/fitur/notulen-otomatis-kontrak.md,
 * docs/DATABASE.md §7 meeting_transcripts): the organizer's `auto_minutes`
 * switch, one transcript (+ AI draft) per meeting occurrence written by the
 * transcriber worker, and each person's "Jangan transkrip suara saya" choice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->boolean('auto_minutes')->default(false);
        });

        Schema::create('meeting_transcripts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('meeting_id')->constrained()->cascadeOnDelete();
            $table->date('occurrence_date');
            $table->string('room', 64);
            $table->string('status', 12)->default('recording');
            $table->string('error', 300)->nullable();
            $table->string('language', 8)->nullable();
            $table->string('model', 80)->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('ended_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            // [{speaker_identity, user_id, speaker_name, start_ms, end_ms, text}] ordered by start_ms.
            $table->jsonb('segments')->default('[]');
            // Worker session ids already merged in (a room can be recorded in several parts).
            $table->jsonb('sessions')->default('[]');
            $table->jsonb('draft')->nullable();
            $table->string('draft_status', 12)->nullable();
            $table->string('draft_error', 300)->nullable();
            $table->string('draft_model', 80)->nullable();
            $table->timestampTz('draft_generated_at')->nullable();
            $table->timestampTz('inserted_at')->nullable();
            $table->foreignUlid('inserted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('discarded_at')->nullable();
            $table->timestampTz('purge_after')->nullable();
            $table->timestampsTz();

            $table->unique(['meeting_id', 'occurrence_date']);
            $table->index('purge_after');
        });

        DB::statement("ALTER TABLE meeting_transcripts ADD CONSTRAINT meeting_transcripts_status_check CHECK (status IN ('recording', 'transcribing', 'summarizing', 'ready', 'failed'))");
        DB::statement("ALTER TABLE meeting_transcripts ADD CONSTRAINT meeting_transcripts_draft_status_check CHECK (draft_status IS NULL OR draft_status IN ('pending', 'ready', 'failed', 'disabled', 'inserted', 'discarded'))");

        Schema::create('meeting_transcript_consents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('meeting_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('opted_out')->default(false);
            $table->timestampsTz();

            $table->unique(['meeting_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_transcript_consents');
        Schema::dropIfExists('meeting_transcripts');

        Schema::table('meetings', function (Blueprint $table) {
            $table->dropColumn('auto_minutes');
        });
    }
};
