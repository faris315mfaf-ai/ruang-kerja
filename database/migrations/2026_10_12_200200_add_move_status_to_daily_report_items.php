<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Laporan progres harian: "pindahkan ke …" chosen on a report item. Kept on
 * the draft so the choice survives a reload; applied (MoveTask, task policy)
 * when the report is sent, which also fills status_category_after
 * (docs/DATABASE.md §4 daily_reports).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_report_items', function (Blueprint $table) {
            $table->foreignUlid('move_status_id')->nullable()->after('status_category_after')
                ->constrained('task_statuses')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('daily_report_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('move_status_id');
        });
    }
};
