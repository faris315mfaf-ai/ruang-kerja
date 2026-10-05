<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Immutable: every check-in/out event. Only the HR review columns change.
        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('attendance_day_id')->constrained()->restrictOnDelete();
            $table->string('type', 10);
            $table->string('method', 20);
            $table->timestampTz('occurred_at');
            $table->timestampTz('client_time')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->foreignUlid('office_location_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->decimal('distance_m', 10, 2)->nullable();
            $table->string('selfie_path', 255)->nullable();
            // FK to qr_tokens is added in Sprint 3.
            $table->ulid('qr_token_id')->nullable();
            $table->ipAddress()->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('device_fingerprint', 128)->nullable();
            $table->jsonb('flags')->default('[]');
            $table->boolean('is_suspicious')->default(false);
            $table->foreignUlid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->foreignUlid('corrected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'occurred_at']);
            $table->index('attendance_day_id');
        });

        DB::statement('CREATE INDEX attendance_logs_suspicious_index ON attendance_logs (occurred_at) WHERE is_suspicious AND reviewed_at IS NULL');

        Schema::table('attendance_days', function (Blueprint $table) {
            $table->foreign('check_in_log_id')->references('id')->on('attendance_logs')->nullOnDelete();
            $table->foreign('check_out_log_id')->references('id')->on('attendance_logs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropForeign(['check_in_log_id']);
            $table->dropForeign(['check_out_log_id']);
        });

        Schema::dropIfExists('attendance_logs');
    }
};
