<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Batas pengajuan di hari-H (keputusan pemilik 14 Okt 2026): sakit & izin untuk
 * hari ini harus dikirim sebelum jam 12.00 waktu kantor, lewat itu hari tercatat
 * alpha. `submit_cutoff_time` null = tanpa batas; HR mengubahnya di
 * Admin › Jenis pengajuan (docs/DATABASE.md §3 leave_types).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->time('submit_cutoff_time', 0)->nullable()->after('max_backdate_days');
        });

        DB::table('leave_types')
            ->whereIn('category', ['sick', 'permit'])
            ->update(['submit_cutoff_time' => '12:00:00']);
    }

    public function down(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropColumn('submit_cutoff_time');
        });
    }
};
