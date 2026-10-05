<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * "Ruang saya" (Beranda): the signed-in user's own plan for a task — lane
 * (today / week / later), order inside the lane and when a newly assigned
 * task was accepted. Private to that user (docs/DATABASE.md §4 task_plans).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_plans', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('task_id')->constrained()->cascadeOnDelete();
            // null = placed automatically by due date (the row only remembers seen_at).
            $table->string('bucket', 10)->nullable();
            // Office date the bucket was set ("terbawa dari kemarin").
            $table->date('planned_for')->nullable();
            // Lexorank key inside the lane; "C" collation = byte order (Lexorank::between()).
            $table->string('position', 100)->collation('C')->nullable();
            $table->timestampTz('seen_at')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'task_id']);
            $table->index(['user_id', 'bucket', 'position']);
            $table->index('task_id');
        });

        DB::statement("ALTER TABLE task_plans ADD CONSTRAINT task_plans_bucket_check CHECK (bucket IS NULL OR bucket IN ('today', 'week', 'later'))");
        DB::statement('ALTER TABLE task_plans ADD CONSTRAINT task_plans_position_check CHECK ((bucket IS NULL) = (position IS NULL))');
    }

    public function down(): void
    {
        Schema::dropIfExists('task_plans');
    }
};
