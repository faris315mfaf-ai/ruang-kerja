<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Feed & history, append-only (no updated_at).
        Schema::create('activities', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('workspace_id')->constrained()->cascadeOnDelete();
            $table->ulidMorphs('subject');
            $table->foreignUlid('causer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 60);
            $table->jsonb('properties')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['workspace_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
