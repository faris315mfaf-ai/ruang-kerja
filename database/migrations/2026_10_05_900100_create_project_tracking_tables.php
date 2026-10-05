<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Project tracking (PRD M10, docs/DATABASE.md §4): milestones, weekly PIC
 * updates, risks, Direksi directions and the daily burn-up snapshots.
 * Project attributes themselves live on `workspaces` (Sprint 5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('milestones', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->date('target_date');
            $table->timestampTz('completed_at')->nullable();
            // Lexorank key, byte order (same as tasks.position).
            $table->string('position', 100)->collation('C');
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['workspace_id', 'target_date']);
        });

        Schema::create('milestone_tasks', function (Blueprint $table) {
            $table->foreignUlid('milestone_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('task_id')->index()->constrained()->cascadeOnDelete();

            $table->primary(['milestone_id', 'task_id']);
        });

        Schema::create('project_updates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('health', 20);
            $table->text('summary');
            $table->text('blockers')->nullable();
            $table->text('decision_needed')->nullable();
            $table->timestampTz('decision_resolved_at')->nullable();
            $table->foreignUlid('decision_resolved_by')->nullable()->constrained('users')->nullOnDelete();
            // Actual / planned progress (percent) when the update was written.
            $table->decimal('progress_snapshot', 5, 2)->nullable();
            $table->decimal('planned_snapshot', 5, 2)->nullable();
            $table->timestampsTz();

            $table->index(['workspace_id', 'created_at']);
        });

        DB::statement("ALTER TABLE project_updates ADD CONSTRAINT project_updates_health_check CHECK (health IN ('on_track', 'at_risk', 'off_track'))");
        // "Butuh keputusan": open decisions are looked up across all projects.
        DB::statement('CREATE INDEX project_updates_open_decision_index ON project_updates (workspace_id) WHERE decision_needed IS NOT NULL AND decision_resolved_at IS NULL');

        Schema::create('project_risks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200);
            $table->string('level', 10);
            $table->foreignUlid('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 10)->default('open');
            $table->timestampTz('resolved_at')->nullable();
            $table->foreignUlid('task_id')->nullable()->constrained()->nullOnDelete();
            $table->timestampsTz();

            $table->index(['workspace_id', 'status']);
        });

        DB::statement("ALTER TABLE project_risks ADD CONSTRAINT project_risks_level_check CHECK (level IN ('high', 'medium', 'low'))");
        DB::statement("ALTER TABLE project_risks ADD CONSTRAINT project_risks_status_check CHECK (status IN ('open', 'resolved'))");

        // Direksi direction ("Beri arahan"), optionally on one update. Stands in for
        // `comments` (Sprint 6) so the project module does not depend on it.
        Schema::create('project_directions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('project_update_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->foreignUlid('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->timestampsTz();

            $table->index(['workspace_id', 'created_at']);
        });

        // One row per project per office date, written by TakeProjectProgressSnapshots (23.55).
        Schema::create('project_progress_snapshots', function (Blueprint $table) {
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->integer('scope_count');
            $table->integer('done_count');
            $table->decimal('scope_hours', 10, 2)->nullable();
            $table->decimal('done_hours', 10, 2)->nullable();
            $table->timestampsTz();

            $table->primary(['workspace_id', 'date']);
        });

        DB::statement('ALTER TABLE project_progress_snapshots ADD CONSTRAINT project_progress_snapshots_counts_check CHECK (scope_count >= 0 AND done_count >= 0 AND done_count <= scope_count)');

        // Lifecycle & health of project workspaces (columns from Sprint 5).
        DB::statement("ALTER TABLE workspaces ADD CONSTRAINT workspaces_project_status_check CHECK (project_status IS NULL OR project_status IN ('planned', 'active', 'on_hold', 'completed', 'canceled'))");
        DB::statement("ALTER TABLE workspaces ADD CONSTRAINT workspaces_health_check CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track'))");
        DB::statement("CREATE INDEX workspaces_project_status_index ON workspaces (company_id, project_status) WHERE type = 'project'");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS workspaces_project_status_index');
        DB::statement('ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_health_check');
        DB::statement('ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_project_status_check');

        Schema::dropIfExists('project_progress_snapshots');
        Schema::dropIfExists('project_directions');
        Schema::dropIfExists('project_risks');
        Schema::dropIfExists('project_updates');
        Schema::dropIfExists('milestone_tasks');
        Schema::dropIfExists('milestones');
    }
};
