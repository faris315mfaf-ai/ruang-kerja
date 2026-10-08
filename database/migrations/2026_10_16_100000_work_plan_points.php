<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The work plan becomes a numbered list of points (owner decision 9 Oct
 * 2026): text → jsonb array of trimmed, non-empty lines. Postgres forbids
 * subqueries in ALTER TYPE USING, so the conversion runs through a helper
 * column and a swap.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->jsonb('work_plan_points')->nullable();
        });

        DB::statement(<<<'SQL'
            UPDATE attendance_days
            SET work_plan_points = to_jsonb(
                array(SELECT btrim(line) FROM unnest(string_to_array(work_plan, E'\n')) AS line WHERE btrim(line) <> '')
            )
            WHERE work_plan IS NOT NULL AND btrim(work_plan) <> ''
        SQL);

        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropColumn('work_plan');
        });

        DB::statement('ALTER TABLE attendance_days RENAME COLUMN work_plan_points TO work_plan');
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->text('work_plan_text')->nullable();
        });

        DB::statement(<<<'SQL'
            UPDATE attendance_days
            SET work_plan_text = (SELECT string_agg(line, E'\n') FROM jsonb_array_elements_text(work_plan) AS line)
            WHERE work_plan IS NOT NULL
        SQL);

        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropColumn('work_plan');
        });

        DB::statement('ALTER TABLE attendance_days RENAME COLUMN work_plan_text TO work_plan');
    }
};
