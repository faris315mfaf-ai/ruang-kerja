<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Ruang HR (keputusan pemilik 20 Okt 2026, docs/fitur/ruang-hr.md): two
 * system workspaces per company — "Tim HR" (hr_team, shared notes of the HR
 * team) and "Penugasan HR" (hr_assignments, tasks HR gives to employees).
 * `tasks_private` = members below admin only see the tasks assigned to them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('system_key', 30)->nullable()->after('team_id');
            $table->boolean('tasks_private')->default(false)->after('system_key');
        });

        DB::statement("ALTER TABLE workspaces ADD CONSTRAINT workspaces_system_key_check CHECK (system_key IS NULL OR system_key IN ('hr_team', 'hr_assignments'))");
        DB::statement('CREATE UNIQUE INDEX workspaces_company_system_key_unique ON workspaces (company_id, system_key) WHERE system_key IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS workspaces_company_system_key_unique');
        DB::statement('ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_system_key_check');

        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn(['system_key', 'tasks_private']);
        });
    }
};
