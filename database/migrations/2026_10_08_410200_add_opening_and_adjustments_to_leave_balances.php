<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fitur pengajuan #3: explicit opening balance ("saldo awal") and an audited
     * adjustments ledger. leave_balances.adjustment_days is the running sum of
     * leave_balance_adjustments.delta_days (kept by AdjustLeaveBalance under a
     * row lock) so the non-negative CHECK still covers every component:
     *
     *   available = entitled + carried_over + opening + Σadjustments − used − pending ≥ 0
     */
    public function up(): void
    {
        Schema::table('leave_balances', function (Blueprint $table) {
            $table->decimal('opening_days', 5, 1)->default(0)->after('carried_over_days');
            // May be negative (days taken back); the total stays ≥ 0 by CHECK.
            $table->decimal('adjustment_days', 5, 1)->default(0)->after('opening_days');
        });

        DB::statement('ALTER TABLE leave_balances DROP CONSTRAINT leave_balances_non_negative');
        DB::statement('ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_non_negative CHECK (
            entitled_days >= 0 AND carried_over_days >= 0 AND opening_days >= 0 AND used_days >= 0 AND pending_days >= 0
            AND entitled_days + carried_over_days + opening_days + adjustment_days - used_days - pending_days >= 0
        )');

        Schema::create('leave_balance_adjustments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('balance_id')->index()->constrained('leave_balances')->cascadeOnDelete();
            $table->decimal('delta_days', 5, 1);
            $table->string('reason', 255);
            $table->foreignUlid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement('ALTER TABLE leave_balance_adjustments ADD CONSTRAINT leave_balance_adjustments_delta_non_zero CHECK (delta_days <> 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_balance_adjustments');

        DB::statement('ALTER TABLE leave_balances DROP CONSTRAINT leave_balances_non_negative');
        DB::statement('ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_non_negative CHECK (
            entitled_days >= 0 AND carried_over_days >= 0 AND used_days >= 0 AND pending_days >= 0
            AND entitled_days + carried_over_days - used_days - pending_days >= 0
        )');

        Schema::table('leave_balances', function (Blueprint $table) {
            $table->dropColumn(['opening_days', 'adjustment_days']);
        });
    }
};
