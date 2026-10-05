<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rich-text comments (Tiptap JSON) on tasks; later also project updates (Sprint 9).
        Schema::create('comments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulidMorphs('commentable');
            $table->foreignUlid('user_id')->index()->constrained()->cascadeOnDelete();
            $table->jsonb('body');
            $table->text('body_text');
            $table->timestampTz('edited_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['commentable_type', 'commentable_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
