<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotency of the authenticated API v1 writes (offline-first Android app,
 * owner decision 14 Oct 2026): a retried POST/PUT/PATCH/DELETE carrying the
 * same `Idempotency-Key` replays the first result instead of running twice.
 * A row is claimed before the handler runs (unique per user + key) and
 * completed with the stored response; rows older than 72 hours are pruned
 * (`api:prune-idempotency`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_idempotency_keys', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('key', 64);
            $table->string('method', 10);
            $table->char('path_hash', 64);
            $table->smallInteger('status')->nullable();
            $table->jsonb('response_headers')->nullable();
            $table->text('response_body')->nullable();
            $table->timestampTz('created_at');
            $table->timestampTz('completed_at')->nullable();

            $table->unique(['user_id', 'key']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_idempotency_keys');
    }
};
