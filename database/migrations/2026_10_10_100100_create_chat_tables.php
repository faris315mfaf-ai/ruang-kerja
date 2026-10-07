<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Obrolan (Fase 2, F2-1; docs/DATABASE.md §7): channels (one automatic channel
 * per non-personal workspace, public/private channels, DMs and small groups),
 * their members with a read pointer, and messages with threads. Reactions,
 * mentions and Drive attachments reuse the morph tables of task comments.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channels', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('workspace_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('name', 80)->nullable();
            $table->string('topic', 250)->nullable();
            // SHA-256 of the sorted member ids of a DM / group: reopening the
            // same people reuses the conversation (OpenDirectConversation).
            $table->char('direct_key', 64)->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();

            $table->index(['company_id', 'type']);
        });

        DB::statement("ALTER TABLE channels ADD CONSTRAINT channels_type_check CHECK (type IN ('workspace', 'public', 'private', 'dm', 'group'))");
        DB::statement("ALTER TABLE channels ADD CONSTRAINT channels_name_check CHECK ((type IN ('dm', 'group')) = (name IS NULL))");
        DB::statement("ALTER TABLE channels ADD CONSTRAINT channels_workspace_check CHECK ((type = 'workspace') = (workspace_id IS NOT NULL))");
        DB::statement("ALTER TABLE channels ADD CONSTRAINT channels_direct_key_check CHECK ((type IN ('dm', 'group')) = (direct_key IS NOT NULL))");
        DB::statement("CREATE UNIQUE INDEX channels_workspace_unique ON channels (workspace_id) WHERE type = 'workspace'");
        DB::statement('CREATE UNIQUE INDEX channels_direct_key_unique ON channels (company_id, direct_key) WHERE direct_key IS NOT NULL');

        Schema::create('channel_members', function (Blueprint $table) {
            $table->foreignUlid('channel_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 10)->default('member');
            $table->boolean('muted')->default(false);
            // Last message the member has seen (ULIDs sort by time): unread = newer messages.
            $table->ulid('last_read_message_id')->nullable();
            $table->timestampTz('joined_at')->nullable();
            $table->timestampsTz();

            $table->primary(['channel_id', 'user_id']);
            $table->index('user_id');
        });

        DB::statement("ALTER TABLE channel_members ADD CONSTRAINT channel_members_role_check CHECK (role IN ('owner', 'admin', 'member'))");

        Schema::create('messages', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('channel_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->ulid('parent_id')->nullable();
            $table->jsonb('body')->nullable();
            $table->text('body_text')->default('');
            $table->timestampTz('edited_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['channel_id', 'id']);
            $table->index(['parent_id', 'id']);
        });

        // Thread root: self reference added once the primary key exists.
        Schema::table('messages', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('messages')->cascadeOnDelete();
        });

        // Postgres has no Indonesian stemmer: 'simple' like tasks.search_vector.
        DB::statement("ALTER TABLE messages ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body_text, ''))) STORED");
        DB::statement('CREATE INDEX messages_search_vector_index ON messages USING GIN (search_vector)');
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('channel_members');
        Schema::dropIfExists('channels');
    }
};
