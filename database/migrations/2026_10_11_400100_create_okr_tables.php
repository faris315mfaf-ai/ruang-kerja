<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * OKR divisi (Fase 3, F3-3; docs/DATABASE.md §8): objectives per division per
 * quarter, weighted key results, append-only weekly check-ins and the tasks a
 * key result is linked to.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('objectives', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('division_id')->constrained()->restrictOnDelete();
            $table->string('quarter', 7);
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->foreignUlid('owner_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 10)->default('active');
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['company_id', 'quarter']);
            $table->index(['division_id', 'quarter']);
        });

        DB::statement("ALTER TABLE objectives ADD CONSTRAINT objectives_quarter_check CHECK (quarter ~ '^[0-9]{4}-Q[1-4]$')");
        DB::statement("ALTER TABLE objectives ADD CONSTRAINT objectives_status_check CHECK (status IN ('draft', 'active', 'closed'))");
        DB::statement("ALTER TABLE objectives ADD CONSTRAINT objectives_closed_check CHECK ((status = 'closed') = (closed_at IS NOT NULL))");

        Schema::create('key_results', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('objective_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('unit', 10);
            $table->string('unit_label', 20)->default('');
            $table->decimal('start_value', 14, 2);
            $table->decimal('target_value', 14, 2);
            $table->decimal('current_value', 14, 2);
            $table->decimal('weight', 5, 2)->default(1);
            $table->foreignUlid('owner_id')->constrained('users')->restrictOnDelete();
            $table->smallInteger('position')->default(0);
            $table->timestampsTz();

            $table->index(['objective_id', 'position']);
            $table->index('owner_id');
        });

        DB::statement("ALTER TABLE key_results ADD CONSTRAINT key_results_unit_check CHECK (unit IN ('number', 'percent', 'currency', 'days'))");
        DB::statement('ALTER TABLE key_results ADD CONSTRAINT key_results_weight_check CHECK (weight > 0 AND weight <= 100)');
        DB::statement('ALTER TABLE key_results ADD CONSTRAINT key_results_target_check CHECK (target_value <> start_value)');

        Schema::create('key_result_checkins', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('key_result_id')->constrained()->cascadeOnDelete();
            $table->decimal('value', 14, 2);
            $table->smallInteger('confidence')->nullable();
            $table->text('note')->nullable();
            $table->foreignUlid('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('checked_on');
            $table->timestampTz('created_at')->nullable();

            $table->index(['key_result_id', 'checked_on']);
        });

        DB::statement('ALTER TABLE key_result_checkins ADD CONSTRAINT key_result_checkins_confidence_check CHECK (confidence BETWEEN 1 AND 10)');

        Schema::create('key_result_tasks', function (Blueprint $table) {
            $table->foreignUlid('key_result_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('task_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('linked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at')->nullable();

            $table->primary(['key_result_id', 'task_id']);
            $table->index('task_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('key_result_tasks');
        Schema::dropIfExists('key_result_checkins');
        Schema::dropIfExists('key_results');
        Schema::dropIfExists('objectives');
    }
};
