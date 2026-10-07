<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dashboard per jabatan (F3, docs/fitur/dashboard-peran.md): HR maps a
 * position to one of the 8 SPKD job dashboards
 * (App\Domain\RoleDashboards\Enums\DashboardRole).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->string('dashboard_role', 20)->nullable()->after('level');
        });

        DB::statement("ALTER TABLE positions ADD CONSTRAINT positions_dashboard_role_check CHECK (dashboard_role IS NULL OR dashboard_role IN ('dirut', 'direktur', 'hr', 'corsec', 'marketing', 'programming', 'implementer', 'analis'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_dashboard_role_check');

        Schema::table('positions', function (Blueprint $table) {
            $table->dropColumn('dashboard_role');
        });
    }
};
