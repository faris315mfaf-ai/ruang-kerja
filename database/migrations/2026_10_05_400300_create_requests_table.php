<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            // Assigned on first submission (drafts have none). Unique when present.
            $table->string('number', 30)->nullable()->unique();
            $table->foreignUlid('user_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('leave_type_id')->index()->constrained()->restrictOnDelete();
            $table->timestampTz('start_at');
            $table->timestampTz('end_at');
            $table->decimal('days', 5, 1)->nullable();
            $table->unsignedInteger('minutes')->nullable();
            $table->text('reason');
            $table->jsonb('payload')->default('{}');
            $table->foreignUlid('substitute_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('draft');
            $table->unsignedSmallInteger('round')->default(1);
            $table->unsignedSmallInteger('current_step')->nullable();
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'start_at', 'end_at']);
        });

        DB::statement('ALTER TABLE requests ADD CONSTRAINT requests_period_order CHECK (end_at >= start_at)');

        Schema::create('request_approvals', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('request_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('round')->default(1);
            $table->unsignedSmallInteger('step_order');
            // Snapshot of the flow step, so later flow edits never touch running requests.
            $table->string('approver_type', 20);
            $table->string('approver_role', 40)->nullable();
            // Resolved when the step becomes active; null for a waiting role step
            // (any holder may decide; filled with the decider).
            $table->foreignUlid('approver_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignUlid('delegated_from_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20);
            $table->text('note')->nullable();
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->timestampsTz();

            $table->unique(['request_id', 'round', 'step_order']);
            $table->index(['approver_id', 'status']);
            $table->index(['status', 'approver_role']);
        });

        Schema::create('approval_delegations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('delegator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('delegate_id')->index()->constrained('users')->cascadeOnDelete();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('reason', 255)->nullable();
            $table->timestampsTz();

            $table->index(['delegator_id', 'starts_on', 'ends_on']);
        });

        DB::statement('ALTER TABLE approval_delegations ADD CONSTRAINT approval_delegations_period CHECK (ends_on >= starts_on AND delegator_id <> delegate_id)');

        // Monthly counters per prefix (CUT-2026-10 → 14). Incremented atomically.
        Schema::create('request_sequences', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('key', 30)->unique();
            $table->unsignedInteger('last_number')->default(0);
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_sequences');
        Schema::dropIfExists('approval_delegations');
        Schema::dropIfExists('request_approvals');
        Schema::dropIfExists('requests');
    }
};
