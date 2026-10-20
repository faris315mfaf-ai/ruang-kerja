<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Jadwal wawancara kandidat (Ruang HR, keputusan pemilik 20 Okt 2026): one
 * planned interview per candidate, shown on Ruang HR › Jadwal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->timestampTz('interview_at')->nullable()->after('decided_at');
            $table->string('interview_location', 200)->nullable()->after('interview_at');

            $table->index(['company_id', 'interview_at']);
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'interview_at']);
            $table->dropColumn(['interview_at', 'interview_location']);
        });
    }
};
