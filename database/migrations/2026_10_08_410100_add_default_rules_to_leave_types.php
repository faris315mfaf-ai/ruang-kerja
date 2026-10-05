<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fitur pengajuan #1:
     * - is_provisional_default: seeded default ("Bawaan sementara") that HR has not
     *   reviewed yet; cleared as soon as HR saves the type.
     * - counts_calendar_days: duration counted in calendar days (Cuti melahirkan)
     *   instead of working days.
     * - max_days_per_request: upper bound per request (Cuti melahirkan 90 hari,
     *   Cuti alasan penting 3 hari per peristiwa).
     */
    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->boolean('is_provisional_default')->default(false)->after('sort_order');
            $table->boolean('counts_calendar_days')->default(false)->after('allow_half_day');
            $table->decimal('max_days_per_request', 5, 1)->nullable()->after('counts_calendar_days');
        });

        DB::statement('ALTER TABLE leave_types ADD CONSTRAINT leave_types_max_days_positive CHECK (max_days_per_request IS NULL OR max_days_per_request > 0)');

        // Types seeded by RequestSeeder and never saved since are still untouched defaults.
        DB::table('leave_types')
            ->whereIn('code', ['CUT', 'CBR', 'SKT', 'IZN', 'LBR', 'KOR', 'DNS'])
            ->whereColumn('updated_at', 'created_at')
            ->update(['is_provisional_default' => true]);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE leave_types DROP CONSTRAINT IF EXISTS leave_types_max_days_positive');

        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropColumn(['is_provisional_default', 'counts_calendar_days', 'max_days_per_request']);
        });
    }
};
