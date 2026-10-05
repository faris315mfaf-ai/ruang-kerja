<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Database-level guarantees behind DivisionRequest/TeamRequest (concurrent
 * requests can both pass validation):
 * - one live board (Direksi) unit per company,
 * - team codes unique within a division (null codes allowed; soft-deleted
 *   teams free their code, as TeamRequest already allows).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE UNIQUE INDEX divisions_one_board_per_company_unique ON divisions (company_id) WHERE is_board AND deleted_at IS NULL');
        DB::statement('CREATE UNIQUE INDEX teams_division_code_unique ON teams (division_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS teams_division_code_unique');
        DB::statement('DROP INDEX IF EXISTS divisions_one_board_per_company_unique');
    }
};
