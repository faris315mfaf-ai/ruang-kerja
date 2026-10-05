<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_days', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->restrictOnDelete();
            $table->date('work_date');
            // Snapshot of the day's schedule.
            $table->foreignUlid('shift_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->timestampTz('scheduled_start')->nullable();
            $table->timestampTz('scheduled_end')->nullable();
            $table->timestampTz('check_in_at')->nullable();
            $table->timestampTz('check_out_at')->nullable();
            // FKs to attendance_logs are added by the attendance_logs migration.
            $table->ulid('check_in_log_id')->nullable();
            $table->ulid('check_out_log_id')->nullable();
            $table->string('status', 20);
            $table->smallInteger('late_minutes')->default(0);
            $table->smallInteger('early_leave_minutes')->default(0);
            $table->integer('work_minutes')->default(0);
            $table->integer('overtime_minutes')->default(0);
            // FK to requests is added in Sprint 4 (table does not exist yet).
            $table->ulid('request_id')->nullable()->index();
            $table->boolean('is_suspicious')->default(false);
            $table->text('note')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'work_date']);
            $table->index(['work_date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_days');
    }
};
