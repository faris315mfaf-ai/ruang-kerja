<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * attendance_days.request_portion: `full` | `half_day` for days linked to an
     * approved absence request (review fix Sprint 2/4 #2).
     */
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->string('request_portion', 10)->nullable()->after('request_id');
        });

        DB::statement("ALTER TABLE attendance_days ADD CONSTRAINT attendance_days_request_portion_check CHECK (request_portion IN ('full', 'half_day'))");

        // Existing request rows: half day when the request says so, otherwise full.
        DB::statement(<<<'SQL'
            UPDATE attendance_days AS d
            SET request_portion = CASE WHEN COALESCE((r.payload->>'half_day')::boolean, false) THEN 'half_day' ELSE 'full' END
            FROM requests AS r
            WHERE d.request_id = r.id
            SQL);
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropColumn('request_portion');
        });
    }
};
