<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->string('type', 20);
            $table->string('name', 120);
            // Task id prefix (OPS → OPS-142), unique per company.
            $table->string('key', 10);
            // Keys used before a rename, so old links keep redirecting.
            $table->jsonb('previous_keys')->default(new Expression("'[]'::jsonb"));
            $table->text('description')->nullable();
            $table->string('icon', 50)->nullable();
            // Palette name (resources/css/palette.css), never a hex value.
            $table->string('color', 20)->nullable();
            $table->string('visibility', 20)->default('private');
            $table->foreignUlid('owner_id')->constrained('users')->restrictOnDelete();
            $table->foreignUlid('division_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->foreignUlid('team_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->string('drive_folder_id')->nullable();
            // Next task number; incremented with UPDATE … RETURNING (row lock).
            $table->integer('task_sequence')->default(0);
            $table->timestampTz('archived_at')->nullable();

            // Project attributes (type = project, PRD M10; used from Sprint 9).
            $table->foreignUlid('lead_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUlid('sponsor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('start_date')->nullable();
            $table->date('target_date')->nullable();
            $table->string('project_status', 20)->nullable();
            $table->string('health', 20)->nullable();
            $table->timestampTz('last_update_at')->nullable();
            $table->timestampTz('completed_at')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['company_id', 'key']);
            $table->index(['company_id', 'type']);
        });

        DB::statement("ALTER TABLE workspaces ADD CONSTRAINT workspaces_key_format_check CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$')");
        DB::statement('ALTER TABLE workspaces ADD CONSTRAINT workspaces_task_sequence_check CHECK (task_sequence >= 0)');
        // One personal workspace per user and one workspace per division.
        DB::statement("CREATE UNIQUE INDEX workspaces_personal_owner_unique ON workspaces (owner_id) WHERE type = 'personal'");
        DB::statement("CREATE UNIQUE INDEX workspaces_division_unique ON workspaces (division_id) WHERE type = 'division'");

        Schema::create('workspace_members', function (Blueprint $table) {
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->index()->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            $table->timestampTz('joined_at')->useCurrent();
            // True when the row comes from the division/team sync.
            $table->boolean('is_synced')->default(false);
            // Sidebar: favorites first, in the order they were starred.
            $table->timestampTz('favorited_at')->nullable();
            $table->timestampsTz();

            $table->primary(['workspace_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_members');
        Schema::dropIfExists('workspaces');
    }
};
