<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_views', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            // null = cross-workspace (e.g. "Tugas saya").
            $table->foreignUlid('workspace_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('layout', 20);
            $table->jsonb('filters')->default('{}');
            $table->jsonb('sort')->nullable();
            $table->boolean('is_shared')->default(false);
            $table->timestampsTz();

            $table->index(['workspace_id', 'is_shared']);
            $table->index(['user_id', 'workspace_id']);
        });

        DB::statement("ALTER TABLE saved_views ADD CONSTRAINT saved_views_layout_check CHECK (layout IN ('board', 'list', 'calendar'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_views');
    }
};
