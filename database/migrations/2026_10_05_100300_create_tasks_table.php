<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->restrictOnDelete();
            // Unique per workspace, shown as KEY-number.
            $table->integer('number');
            $table->ulid('parent_id')->nullable()->index();
            $table->string('title', 255);
            // Tiptap/ProseMirror JSON document + plain text for search.
            $table->jsonb('description')->nullable();
            $table->text('description_text')->nullable();
            $table->foreignUlid('status_id')->constrained('task_statuses')->restrictOnDelete();
            // Denormalized from task_statuses.category for fast metric queries.
            $table->string('status_category', 20);
            $table->smallInteger('priority')->default(0);
            $table->string('position', 100)->collation('C');
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable();
            $table->decimal('estimate_hours', 6, 2)->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('canceled_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['workspace_id', 'number']);
            $table->index(['workspace_id', 'status_id', 'position']);
            $table->index(['workspace_id', 'status_category']);
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('tasks')->nullOnDelete();
        });

        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority BETWEEN 0 AND 4)');
        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_number_check CHECK (number > 0)');

        // Full-text search over title (weight A) and description text (weight B).
        // "simple" configuration: PostgreSQL ships no Indonesian stemmer.
        DB::statement(<<<'SQL'
            ALTER TABLE tasks ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(title, '')), 'A')
                || setweight(to_tsvector('simple', coalesce(description_text, '')), 'B')
            ) STORED
        SQL);
        DB::statement('CREATE INDEX tasks_search_vector_index ON tasks USING GIN (search_vector)');
        DB::statement("CREATE INDEX tasks_open_due_date_index ON tasks (due_date) WHERE status_category NOT IN ('done', 'canceled')");
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
