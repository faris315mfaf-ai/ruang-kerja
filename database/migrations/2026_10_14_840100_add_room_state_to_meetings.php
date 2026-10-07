<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Ruang rapat "Notulen Hidup" (docs/fitur/rapat-video-kontrak.md,
 * docs/DATABASE.md §7):
 * - meeting_minutes.notes_source*: how the notes of an occurrence were
 *   started on the pre-join screen (continue · template · blank), chosen
 *   once per occurrence by the organizer or minute taker.
 * - meeting_minutes.doc_state / doc_content: the collaborative minutes
 *   document of the room (Yjs state on the collab server + its ProseMirror
 *   snapshot) when FEATURE_NOTES and the collab server are available.
 * - meeting_speaking_times: each participant's own accumulated speaking
 *   time per occurrence (monotonic, capped server-side).
 * - meeting_video_removals: people the organizer removed from the room of an
 *   occurrence; they get no new token until re-admitted (audit R-04).
 * - meeting_attendances: partial index on open rows per room for
 *   room_finished (audit R-13).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meeting_minutes', function (Blueprint $table) {
            $table->string('notes_source', 10)->nullable();
            $table->foreignUlid('notes_source_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('notes_source_at')->nullable();
            // Collaborative minutes document (never sent to the browser as such).
            $table->binary('doc_state')->nullable();
            $table->jsonb('doc_content')->nullable();
        });

        DB::statement("ALTER TABLE meeting_minutes ADD CONSTRAINT meeting_minutes_notes_source_check CHECK (notes_source IS NULL OR notes_source IN ('continue', 'template', 'blank'))");
        DB::statement('ALTER TABLE meeting_minutes ADD CONSTRAINT meeting_minutes_notes_source_at_check CHECK ((notes_source IS NULL) = (notes_source_at IS NULL))');

        Schema::create('meeting_speaking_times', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('meeting_id')->constrained()->cascadeOnDelete();
            // Office date of the occurrence (one LiveKit room per date).
            $table->date('occurrence_date');
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('ms_spoken')->default(0);
            $table->timestampsTz();

            $table->unique(['meeting_id', 'occurrence_date', 'user_id']);
            $table->index('user_id');
        });

        DB::statement('ALTER TABLE meeting_speaking_times ADD CONSTRAINT meeting_speaking_times_ms_check CHECK (ms_spoken >= 0)');

        Schema::create('meeting_video_removals', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('meeting_id')->constrained()->cascadeOnDelete();
            $table->date('occurrence_date');
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('removed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['meeting_id', 'occurrence_date', 'user_id']);
        });

        DB::statement('CREATE INDEX meeting_attendances_open_room_index ON meeting_attendances (room) WHERE left_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS meeting_attendances_open_room_index');
        Schema::dropIfExists('meeting_video_removals');
        Schema::dropIfExists('meeting_speaking_times');

        DB::statement('ALTER TABLE meeting_minutes DROP CONSTRAINT IF EXISTS meeting_minutes_notes_source_at_check');
        DB::statement('ALTER TABLE meeting_minutes DROP CONSTRAINT IF EXISTS meeting_minutes_notes_source_check');

        Schema::table('meeting_minutes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('notes_source_by');
            $table->dropColumn(['notes_source', 'notes_source_at', 'doc_state', 'doc_content']);
        });
    }
};
