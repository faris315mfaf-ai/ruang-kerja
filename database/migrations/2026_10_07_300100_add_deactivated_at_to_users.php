<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * users.deactivated_at: when the employee was set to inactive/resigned
     * (review fix Sprint 3–9 #11). The monthly recap and payroll export count
     * only dates from joined_at up to this date.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestampTz('deactivated_at')->nullable()->after('joined_at');
        });

        // Existing inactive/resigned employees: the latest `user.deactivated`
        // audit row, otherwise the last update of the user row.
        DB::statement(<<<'SQL'
            UPDATE users AS u
            SET deactivated_at = COALESCE(
                (SELECT MAX(a.created_at) FROM audit_logs AS a
                 WHERE a.action = 'user.deactivated' AND a.auditable_id = u.id),
                u.updated_at
            )
            WHERE u.status <> 'active'
            SQL);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('deactivated_at');
        });
    }
};
