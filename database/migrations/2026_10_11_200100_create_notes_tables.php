<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Catatan bersama (Fase 2, F2-2; docs/DATABASE.md §7): notes per workspace
 * (parent/child tree), their version history and per-person sharing. The
 * live document is a Yjs doc on the collab server (collab/); `yjs_state` is
 * its persisted state and `content` the ProseMirror snapshot for rendering
 * and search.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->ulid('parent_id')->nullable();
            // `folder` only groups notes (no content); future kinds (embeds) extend the CHECK.
            $table->string('kind', 10)->default('note');
            $table->string('title', 200);
            $table->string('access', 12)->default('workspace');
            $table->binary('yjs_state')->nullable();
            $table->jsonb('content')->nullable();
            $table->text('content_text')->default('');
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUlid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('position', 100)->collation('C');
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['workspace_id', 'parent_id', 'position']);
            $table->index(['company_id', 'updated_at']);
            $table->index('created_by');
        });

        // Self reference once the primary key exists. A deleted parent leaves
        // its children at the root (MoveNote keeps the tree acyclic).
        Schema::table('notes', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('notes')->nullOnDelete();
        });

        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_access_check CHECK (access IN ('workspace', 'restricted'))");
        DB::statement('ALTER TABLE notes ADD CONSTRAINT notes_parent_check CHECK (parent_id IS NULL OR parent_id <> id)');
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_kind_check CHECK (kind IN ('note', 'folder'))");
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_folder_content_check CHECK (kind = 'note' OR (yjs_state IS NULL AND content IS NULL))");
        // Postgres has no Indonesian stemmer: 'simple' like tasks.search_vector.
        DB::statement(<<<'SQL'
            ALTER TABLE notes ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(title, '')), 'A')
                || setweight(to_tsvector('simple', coalesce(content_text, '')), 'B')
            ) STORED
            SQL);
        DB::statement('CREATE INDEX notes_search_vector_index ON notes USING GIN (search_vector)');

        Schema::create('note_versions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('note_id')->constrained()->cascadeOnDelete();
            $table->binary('yjs_state')->nullable();
            $table->jsonb('content')->nullable();
            $table->string('title', 200);
            $table->string('label', 120)->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at');

            $table->index(['note_id', 'created_at']);
        });

        Schema::create('note_shares', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('note_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 10);
            $table->timestampsTz();

            $table->unique(['note_id', 'user_id']);
            $table->index('user_id');
        });

        DB::statement("ALTER TABLE note_shares ADD CONSTRAINT note_shares_role_check CHECK (role IN ('edit', 'view'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('note_shares');
        Schema::dropIfExists('note_versions');
        Schema::dropIfExists('notes');
    }
};
