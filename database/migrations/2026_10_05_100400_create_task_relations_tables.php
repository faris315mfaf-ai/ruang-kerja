<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_assignees', function (Blueprint $table) {
            $table->foreignUlid('task_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->index()->constrained()->cascadeOnDelete();
            $table->timestampTz('assigned_at')->useCurrent();
            $table->foreignUlid('assigned_by')->nullable()->constrained('users')->nullOnDelete();

            $table->primary(['task_id', 'user_id']);
        });

        Schema::create('task_labels', function (Blueprint $table) {
            $table->foreignUlid('task_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('label_id')->index()->constrained()->cascadeOnDelete();

            $table->primary(['task_id', 'label_id']);
        });

        Schema::create('task_watchers', function (Blueprint $table) {
            $table->foreignUlid('task_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->index()->constrained()->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->primary(['task_id', 'user_id']);
        });

        Schema::create('checklist_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('task_id')->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->boolean('is_done')->default(false);
            $table->string('position', 100)->collation('C');
            $table->foreignUlid('done_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('done_at')->nullable();
            $table->timestampsTz();

            $table->index(['task_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_items');
        Schema::dropIfExists('task_watchers');
        Schema::dropIfExists('task_labels');
        Schema::dropIfExists('task_assignees');
    }
};
