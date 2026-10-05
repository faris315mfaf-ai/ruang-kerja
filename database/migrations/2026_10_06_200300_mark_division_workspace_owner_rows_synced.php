<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The owner row of a division/team workspace follows the organization
     * (review fix Sprint 5 #5): mark existing owner rows as synced so the next
     * sync removes a former owner who is no longer head or member. Rows of
     * former owners already demoted to admin cannot be told apart from manual
     * admins and stay untouched.
     */
    public function up(): void
    {
        DB::statement(<<<'SQL'
            UPDATE workspace_members AS m
            SET is_synced = true
            FROM workspaces AS w
            WHERE m.workspace_id = w.id
              AND m.user_id = w.owner_id
              AND m.role = 'owner'
              AND (w.type = 'division' OR (w.type = 'team' AND w.team_id IS NOT NULL))
            SQL);
    }

    public function down(): void
    {
        // Irreversible data fix: synced owner rows behave like before on rollback.
    }
};
