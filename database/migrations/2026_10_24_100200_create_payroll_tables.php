<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Gaji harian sederhana (keputusan pemilik 20 Okt 2026, docs/fitur/absensi-gaji.md):
 * a daily wage per employee with an effective date, per-company pay rules,
 * and a monthly period that HR can lock (snapshot of the computed rows).
 * Rupiah amounts are whole numbers (bigint).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_wages', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('daily_wage');
            $table->date('effective_from');
            $table->string('note', 255)->nullable();
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['user_id', 'effective_from']);
            $table->index(['company_id', 'user_id']);
        });

        DB::statement('ALTER TABLE employee_wages ADD CONSTRAINT employee_wages_daily_wage_check CHECK (daily_wage >= 0)');

        Schema::create('payroll_rules', function (Blueprint $table) {
            $table->foreignUlid('company_id')->primary()->constrained()->cascadeOnDelete();
            $table->boolean('pay_leave')->default(true);
            $table->boolean('pay_sick')->default(true);
            $table->boolean('pay_permit')->default(false);
            $table->bigInteger('late_deduction')->default(0);
            $table->foreignUlid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE payroll_rules ADD CONSTRAINT payroll_rules_late_deduction_check CHECK (late_deduction >= 0)');

        Schema::create('payroll_periods', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            // First day of the month (office calendar).
            $table->date('month');
            $table->timestampTz('locked_at')->nullable();
            $table->foreignUlid('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->jsonb('snapshot')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'month']);
        });

        DB::statement('ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_month_check CHECK (extract(day from month) = 1)');
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_periods');
        Schema::dropIfExists('payroll_rules');
        Schema::dropIfExists('employee_wages');
    }
};
