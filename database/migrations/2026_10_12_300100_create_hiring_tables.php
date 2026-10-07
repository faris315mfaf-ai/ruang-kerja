<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Hiring (owner decision 6 Oct 2026; docs/DATABASE.md §4b, docs/fitur/hiring.md):
 * HR opens positions, applicants arrive from a Google Form (Apps Script
 * webhook) or are added by hand, move through stages, are reviewed by the
 * position's interviewers (checklist + points per interview question) and
 * decided by the final approvers. Candidate data is personal data: never logged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hiring_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->unique()->constrained()->cascadeOnDelete();
            // Default final approvers of new positions (user ids).
            $table->jsonb('default_final_approver_ids')->default('[]');
            // Checklist items generated per reviewer role: {"hr": [{label, required}], "interviewer": [...], "approver": [...]}.
            $table->jsonb('checklist_template')->default('{}');
            $table->timestampsTz();
        });

        Schema::create('hiring_positions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->string('title', 150);
            $table->foreignUlid('division_id')->nullable()->constrained()->nullOnDelete();
            $table->text('description')->nullable();
            $table->string('status', 10)->default('draft');
            $table->timestampTz('opened_at')->nullable();
            $table->timestampTz('closed_at')->nullable();
            // Part of the webhook URL (/api/hiring/form/{token}); the secret signs the body (HMAC-SHA256).
            $table->char('webhook_token', 40)->unique();
            $table->text('webhook_secret');
            $table->jsonb('interviewer_ids')->default('[]');
            $table->jsonb('final_approver_ids')->default('[]');
            // Google Form question title per candidate field: {full_name, email, phone, cv_url}.
            $table->jsonb('field_map')->default('{}');
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['company_id', 'status']);
        });

        DB::statement("ALTER TABLE hiring_positions ADD CONSTRAINT hiring_positions_status_check CHECK (status IN ('draft', 'open', 'closed'))");
        DB::statement('CREATE INDEX hiring_positions_interviewer_ids_index ON hiring_positions USING GIN (interviewer_ids jsonb_path_ops)');
        DB::statement('CREATE INDEX hiring_positions_final_approver_ids_index ON hiring_positions USING GIN (final_approver_ids jsonb_path_ops)');

        Schema::create('hiring_questions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('position_id')->constrained('hiring_positions')->cascadeOnDelete();
            $table->text('prompt');
            $table->text('guidance')->nullable();
            $table->smallInteger('max_score')->default(5);
            $table->smallInteger('position')->default(0);
            $table->timestampsTz();

            $table->index(['position_id', 'position']);
        });

        DB::statement('ALTER TABLE hiring_questions ADD CONSTRAINT hiring_questions_max_score_check CHECK (max_score BETWEEN 1 AND 10)');

        Schema::create('candidates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('position_id')->constrained('hiring_positions')->restrictOnDelete();
            $table->string('full_name', 150);
            $table->string('email', 190)->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('cv_url', 2000)->nullable();
            $table->jsonb('attachments')->default('[]');
            $table->jsonb('form_answers')->default('[]');
            $table->string('external_response_id', 191)->nullable();
            $table->string('stage', 20)->default('applied');
            $table->text('rejected_reason')->nullable();
            $table->string('source', 20)->default('manual');
            $table->timestampTz('applied_at');
            $table->timestampTz('decided_at')->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['company_id', 'stage']);
            $table->index(['position_id', 'stage']);
        });

        DB::statement("ALTER TABLE candidates ADD CONSTRAINT candidates_stage_check CHECK (stage IN ('applied', 'screening', 'interview', 'assessment', 'final_review', 'hired', 'rejected'))");
        DB::statement("ALTER TABLE candidates ADD CONSTRAINT candidates_source_check CHECK (source IN ('google_form', 'manual'))");
        // One candidate per Form response (webhook retries are idempotent), trashed rows included.
        DB::statement('CREATE UNIQUE INDEX candidates_position_response_unique ON candidates (position_id, external_response_id) WHERE external_response_id IS NOT NULL');

        Schema::create('candidate_checklist_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('candidate_id')->constrained()->cascadeOnDelete();
            // null = HR item (any HR may tick it); otherwise only this reviewer ticks it.
            $table->foreignUlid('reviewer_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('role', 12);
            $table->string('label', 200);
            $table->boolean('is_required')->default(true);
            $table->smallInteger('position')->default(0);
            $table->timestampTz('checked_at')->nullable();
            $table->foreignUlid('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['candidate_id', 'reviewer_id']);
        });

        DB::statement("ALTER TABLE candidate_checklist_items ADD CONSTRAINT candidate_checklist_items_role_check CHECK (role IN ('hr', 'interviewer', 'approver'))");
        DB::statement("ALTER TABLE candidate_checklist_items ADD CONSTRAINT candidate_checklist_items_reviewer_check CHECK ((role = 'hr') = (reviewer_id IS NULL))");

        Schema::create('interview_answers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('candidate_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('question_id')->constrained('hiring_questions')->restrictOnDelete();
            $table->text('answer');
            $table->foreignUlid('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['candidate_id', 'question_id']);
            $table->index('question_id');
        });

        Schema::create('interview_scores', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('candidate_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('question_id')->constrained('hiring_questions')->restrictOnDelete();
            $table->foreignUlid('interviewer_id')->constrained('users')->cascadeOnDelete();
            $table->smallInteger('score');
            $table->text('note')->nullable();
            $table->timestampsTz();

            $table->unique(['candidate_id', 'question_id', 'interviewer_id']);
            $table->index('question_id');
        });

        DB::statement('ALTER TABLE interview_scores ADD CONSTRAINT interview_scores_score_check CHECK (score BETWEEN 1 AND 10)');

        Schema::create('candidate_notes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('candidate_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->timestampTz('edited_at')->nullable();
            $table->timestampsTz();

            $table->index(['candidate_id', 'created_at']);
        });

        Schema::create('candidate_decisions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('candidate_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('approver_id')->constrained('users')->cascadeOnDelete();
            $table->string('decision', 10);
            $table->text('note')->nullable();
            $table->timestampTz('decided_at');
            $table->timestampsTz();

            $table->unique(['candidate_id', 'approver_id']);
        });

        DB::statement("ALTER TABLE candidate_decisions ADD CONSTRAINT candidate_decisions_decision_check CHECK (decision IN ('approve', 'reject'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_decisions');
        Schema::dropIfExists('candidate_notes');
        Schema::dropIfExists('interview_scores');
        Schema::dropIfExists('interview_answers');
        Schema::dropIfExists('candidate_checklist_items');
        Schema::dropIfExists('candidates');
        Schema::dropIfExists('hiring_questions');
        Schema::dropIfExists('hiring_positions');
        Schema::dropIfExists('hiring_settings');
    }
};
