<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Rapat, notulen & kalender (Fase 2, F2-3; docs/DATABASE.md §7). A meeting
 * stores one row per series: recurring meetings are expanded into
 * occurrences when read (MeetingOccurrences), so minutes belong to one
 * occurrence (meeting_id + occurrence_date). Google Calendar sync is on hold:
 * no calendar_events table yet, join links are pasted by the organizer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meetings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('platform', 10);
            $table->string('location', 200)->nullable();
            $table->string('join_url', 500)->nullable();
            $table->foreignUlid('organizer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUlid('minute_taker_id')->nullable()->constrained('users')->nullOnDelete();
            $table->jsonb('agenda')->default('[]');
            $table->string('recurrence', 12)->default('none');
            // Last office date of a series (inclusive); null = no end.
            $table->date('recurrence_until')->nullable();
            $table->boolean('leadership')->default(false);
            $table->timestampTz('canceled_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['company_id', 'starts_at']);
            $table->index(['organizer_id', 'starts_at']);
            $table->index(['minute_taker_id']);
        });

        // Minutes before the start at which participants are reminded.
        DB::statement("ALTER TABLE meetings ADD COLUMN reminders smallint[] NOT NULL DEFAULT '{15,5}'");
        DB::statement('ALTER TABLE meetings ADD CONSTRAINT meetings_time_check CHECK (ends_at > starts_at)');
        DB::statement("ALTER TABLE meetings ADD CONSTRAINT meetings_platform_check CHECK (platform IN ('meet', 'zoom', 'room', 'client'))");
        DB::statement("ALTER TABLE meetings ADD CONSTRAINT meetings_recurrence_check CHECK (recurrence IN ('none', 'weekdays', 'weekly', 'mon_wed_fri'))");
        DB::statement('ALTER TABLE meetings ADD CONSTRAINT meetings_reminders_check CHECK (reminders <@ ARRAY[0,5,10,15,30,60]::smallint[])');
        DB::statement('CREATE INDEX meetings_leadership_index ON meetings (company_id, starts_at) WHERE leadership AND deleted_at IS NULL');

        Schema::create('meeting_participants', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('meeting_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained()->cascadeOnDelete();
            // External guest (lower case); never sees anything in the app.
            $table->string('email', 190)->nullable();
            $table->string('rsvp', 10)->default('pending');
            $table->boolean('optional')->default(false);
            $table->timestampTz('responded_at')->nullable();
            $table->timestampsTz();

            $table->index('user_id');
        });

        DB::statement("ALTER TABLE meeting_participants ADD CONSTRAINT meeting_participants_rsvp_check CHECK (rsvp IN ('pending', 'yes', 'maybe', 'no'))");
        DB::statement('ALTER TABLE meeting_participants ADD CONSTRAINT meeting_participants_who_check CHECK ((user_id IS NULL) <> (email IS NULL))');
        DB::statement('CREATE UNIQUE INDEX meeting_participants_user_unique ON meeting_participants (meeting_id, user_id) WHERE user_id IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX meeting_participants_email_unique ON meeting_participants (meeting_id, email) WHERE email IS NOT NULL');

        Schema::create('meeting_minutes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('meeting_id')->constrained()->cascadeOnDelete();
            // Office date of the occurrence (= the meeting date when not recurring).
            $table->date('occurrence_date');
            $table->string('status', 10)->default('draft');
            $table->jsonb('attendance')->default('[]');
            $table->jsonb('sections')->default('[]');
            $table->jsonb('decisions')->default('[]');
            $table->unsignedInteger('version')->default(0);
            $table->foreignUlid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('finalized_at')->nullable();
            $table->foreignUlid('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['meeting_id', 'occurrence_date']);
        });

        DB::statement("ALTER TABLE meeting_minutes ADD CONSTRAINT meeting_minutes_status_check CHECK (status IN ('draft', 'final'))");
        DB::statement("ALTER TABLE meeting_minutes ADD CONSTRAINT meeting_minutes_final_check CHECK ((status = 'final') = (finalized_at IS NOT NULL))");

        Schema::create('meeting_minute_versions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('minutes_id')->constrained('meeting_minutes')->cascadeOnDelete();
            $table->jsonb('content');
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['minutes_id', 'created_at']);
        });

        Schema::create('meeting_action_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('minutes_id')->constrained('meeting_minutes')->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('text', 300)->default('');
            $table->foreignUlid('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->foreignUlid('task_id')->nullable()->constrained()->nullOnDelete();
            $table->timestampTz('done_at')->nullable();
            $table->timestampsTz();

            $table->index(['minutes_id', 'position']);
            $table->index(['assignee_id', 'done_at']);
            $table->index('task_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_action_items');
        Schema::dropIfExists('meeting_minute_versions');
        Schema::dropIfExists('meeting_minutes');
        Schema::dropIfExists('meeting_participants');
        Schema::dropIfExists('meetings');
    }
};
