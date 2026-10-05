<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sprint 10 performance sweep: indexes for queries that filter on a column
 * which is not the leading column of any existing index.
 *
 * - tasks (status_id, position): TaskPositioner / UpdateTaskStatus /
 *   DeleteTaskStatus look up a column's cards by status only (moving a card,
 *   renaming or deleting a column); (workspace_id, status_id, position) cannot
 *   serve them in PostgreSQL 17.
 * - request_approvals (delegated_from_id): EmployeeRequest::visibleTo and the
 *   approval queue match "approver OR delegated from" the viewer.
 * - attachments (drive_file_id): "Dipakai di tugas" on the File tab.
 *
 * Partial where the column is mostly null.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE INDEX IF NOT EXISTS tasks_status_id_position_index ON tasks (status_id, position)');
        DB::statement('CREATE INDEX IF NOT EXISTS request_approvals_delegated_from_id_index ON request_approvals (delegated_from_id) WHERE delegated_from_id IS NOT NULL');
        DB::statement('CREATE INDEX IF NOT EXISTS attachments_drive_file_id_index ON attachments (drive_file_id) WHERE drive_file_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS attachments_drive_file_id_index');
        DB::statement('DROP INDEX IF EXISTS request_approvals_delegated_from_id_index');
        DB::statement('DROP INDEX IF EXISTS tasks_status_id_position_index');
    }
};
