<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Provenance of a task (keputusan pemilik 9 Okt 2026 "rencana kerja jadi
 * tugas otomatis"): `source` = manual | attendance, `source_id` points at
 * the attendance_day whose work-plan point became this task. Not unique per
 * day: one day generates several tasks (one per point); idempotency is
 * handled by CreateWorkPlanTasks. Existing rows default to `manual`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('source', 20)->default('manual');
            $table->foreignUlid('source_id')->nullable()->constrained('attendance_days')->nullOnDelete();
        });

        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_source_check CHECK (source IN ('manual', 'attendance'))");
        DB::statement('CREATE INDEX tasks_source_id_index ON tasks (source_id)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_source_check');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_id');
            $table->dropColumn('source');
        });
    }
};
