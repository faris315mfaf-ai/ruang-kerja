<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Jenis pengajuan yang dikunci (keputusan pemilik 6 Okt 2026): cuti & lembur
 * cannot be requested until the company SOP exists. `locked_reason` not null
 * = locked; HR unlocks in Admin › Jenis pengajuan. Requests already sent or
 * approved are untouched (docs/DATABASE.md §3 leave_types).
 */
return new class extends Migration
{
    public const string REASON = 'Dikunci sampai SOP cuti/lembur ditetapkan.';

    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->string('locked_reason', 200)->nullable()->after('is_active');
        });

        DB::table('leave_types')
            ->whereIn('category', ['leave', 'overtime'])
            ->update(['locked_reason' => self::REASON]);
    }

    public function down(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropColumn('locked_reason');
        });
    }
};
