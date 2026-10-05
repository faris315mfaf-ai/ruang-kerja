<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * leave_balances.generated_at: when the yearly generator (or HR) settled the
     * carry-over. Rows created on first use (a request for next year submitted
     * early) stay null, so the generator still fills their carry-over exactly
     * once (review fix Sprint 4 #4).
     */
    public function up(): void
    {
        Schema::table('leave_balances', function (Blueprint $table) {
            $table->timestampTz('generated_at')->nullable()->after('pending_days');
        });

        // Rows that already carry days over were settled before.
        DB::table('leave_balances')->where('carried_over_days', '>', 0)->update(['generated_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('leave_balances', function (Blueprint $table) {
            $table->dropColumn('generated_at');
        });
    }
};
