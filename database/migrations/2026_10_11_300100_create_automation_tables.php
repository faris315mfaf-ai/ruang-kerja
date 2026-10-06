<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Otomasi (Fase 2, F2-4; docs/DATABASE.md §4 "Otomasi"): "jika … maka …"
 * rules per workspace with their run log, recurring tasks (one occurrence row
 * per scheduled date keeps the 07.00 job idempotent), and task / workspace
 * templates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rules', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            // Denormalized from trigger->type so the listener finds candidates by index.
            $table->string('trigger_type', 30);
            $table->jsonb('trigger');
            $table->jsonb('condition')->nullable();
            $table->jsonb('actions');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('run_count')->default(0);
            $table->timestampTz('last_run_at')->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['workspace_id', 'trigger_type', 'is_active']);
            $table->index(['trigger_type', 'is_active']);
        });

        DB::statement("ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_trigger_type_check CHECK (trigger_type IN ('task_moved', 'task_overdue', 'task_created_with_label'))");
        DB::statement('ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_actions_check CHECK (jsonb_typeof(actions) = \'array\' AND jsonb_array_length(actions) BETWEEN 1 AND 3)');

        Schema::create('automation_runs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('rule_id')->constrained('automation_rules')->cascadeOnDelete();
            $table->foreignUlid('task_id')->nullable()->constrained()->nullOnDelete();
            // Snapshot so the log stays readable after the task is deleted or renamed.
            $table->string('task_key', 20);
            $table->string('task_title', 255);
            $table->string('result', 10);
            $table->string('detail', 255);
            // 0 = started by a person or the daily job; n = n-th rule in a chain.
            $table->unsignedSmallInteger('depth')->default(0);
            // De-duplication key for repeating triggers (overdue: "overdue:<due date>").
            $table->string('cycle', 40)->nullable();
            $table->timestampTz('ran_at');

            $table->index(['rule_id', 'ran_at']);
            $table->index('ran_at');
        });

        DB::statement("ALTER TABLE automation_runs ADD CONSTRAINT automation_runs_result_check CHECK (result IN ('success', 'failed', 'skipped'))");
        DB::statement('CREATE UNIQUE INDEX automation_runs_cycle_unique ON automation_runs (rule_id, task_id, cycle) WHERE cycle IS NOT NULL');

        Schema::create('recurring_tasks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->foreignUlid('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedSmallInteger('priority')->default(0);
            $table->jsonb('pattern');
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('created_count')->default(0);
            $table->date('last_created_on')->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['is_active', 'starts_on']);
            $table->index('workspace_id');
        });

        DB::statement('ALTER TABLE recurring_tasks ADD CONSTRAINT recurring_tasks_priority_check CHECK (priority BETWEEN 0 AND 4)');
        DB::statement('ALTER TABLE recurring_tasks ADD CONSTRAINT recurring_tasks_dates_check CHECK (ends_on IS NULL OR ends_on >= starts_on)');

        Schema::create('recurring_task_occurrences', function (Blueprint $table) {
            $table->foreignUlid('recurring_task_id')->constrained()->cascadeOnDelete();
            $table->date('occurs_on');
            $table->foreignUlid('task_id')->nullable()->constrained()->nullOnDelete();
            $table->timestampTz('created_at');

            $table->primary(['recurring_task_id', 'occurs_on']);
        });

        Schema::create('task_templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            // null = company-wide template (any workspace).
            $table->foreignUlid('workspace_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('description', 255)->nullable();
            $table->string('title', 255);
            $table->unsignedSmallInteger('priority')->default(0);
            $table->decimal('estimate_hours', 6, 2)->nullable();
            $table->jsonb('checklist')->default('[]');
            // [{name, color}] matched by name in the target workspace.
            $table->jsonb('labels')->default('[]');
            $table->unsignedInteger('used_count')->default(0);
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['company_id', 'workspace_id']);
        });

        DB::statement('ALTER TABLE task_templates ADD CONSTRAINT task_templates_priority_check CHECK (priority BETWEEN 0 AND 4)');
        DB::statement('ALTER TABLE task_templates ADD CONSTRAINT task_templates_estimate_check CHECK (estimate_hours IS NULL OR estimate_hours BETWEEN 0.5 AND 999)');

        Schema::create('workspace_templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 80);
            $table->string('description', 255)->nullable();
            $table->string('type', 10);
            // [{name, category, color}] in board order.
            $table->jsonb('statuses');
            // [{name, color}]
            $table->jsonb('labels')->default('[]');
            $table->unsignedInteger('used_count')->default(0);
            $table->foreignUlid('source_workspace_id')->nullable()->constrained('workspaces')->nullOnDelete();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index('company_id');
        });

        DB::statement("ALTER TABLE workspace_templates ADD CONSTRAINT workspace_templates_type_check CHECK (type IN ('team', 'project'))");
        DB::statement("ALTER TABLE workspace_templates ADD CONSTRAINT workspace_templates_statuses_check CHECK (jsonb_typeof(statuses) = 'array' AND jsonb_array_length(statuses) > 0)");
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_templates');
        Schema::dropIfExists('task_templates');
        Schema::dropIfExists('recurring_task_occurrences');
        Schema::dropIfExists('recurring_tasks');
        Schema::dropIfExists('automation_runs');
        Schema::dropIfExists('automation_rules');
    }
};
