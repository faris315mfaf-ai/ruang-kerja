<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Daily work progress reports (Laporan progres harian): one report per
 * employee per office date, with one row per task worked on. Read by the
 * employee's direct manager and the Direksi work monitoring
 * (docs/DATABASE.md §4 daily_reports).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_reports', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            // Office date (config('app.office_timezone')) the report is about.
            $table->date('report_date');
            $table->text('summary')->nullable();
            $table->text('blockers')->nullable();
            // Free notes / short minutes written with the report.
            $table->text('notes')->nullable();
            // null = draft; set when the employee sends the report.
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'report_date']);
            $table->index(['company_id', 'report_date']);
        });

        Schema::create('daily_report_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('daily_report_id')->constrained()->cascadeOnDelete();
            // null = work outside a task (or the task was deleted later).
            $table->foreignUlid('task_id')->nullable()->constrained()->nullOnDelete();
            // Task key + title at report time, so the history stays readable.
            $table->string('task_key', 30)->nullable();
            $table->string('task_title', 255)->nullable();
            $table->text('progress_note');
            // Status category the task was moved to with this report, if any.
            $table->string('status_category_after', 20)->nullable();
            $table->unsignedSmallInteger('percent')->nullable();
            $table->decimal('hours', 5, 2)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestampsTz();

            $table->index(['daily_report_id', 'position']);
            $table->index('task_id');
        });

        DB::statement('ALTER TABLE daily_report_items ADD CONSTRAINT daily_report_items_percent_check CHECK (percent IS NULL OR percent BETWEEN 0 AND 100)');
        DB::statement('ALTER TABLE daily_report_items ADD CONSTRAINT daily_report_items_hours_check CHECK (hours IS NULL OR (hours > 0 AND hours <= 24))');
        DB::statement("ALTER TABLE daily_report_items ADD CONSTRAINT daily_report_items_category_check CHECK (status_category_after IS NULL OR status_category_after IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'canceled'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_report_items');
        Schema::dropIfExists('daily_reports');
    }
};
