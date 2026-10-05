<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use Illuminate\Support\Facades\DB;

/**
 * Rata-rata terlambat = total late minutes ÷ late days (PRD M7). A late day is
 * an `attendance_days` row with `late_minutes > 0` (counted from the shift's
 * tolerance limit, Sprint 2), whatever its final status.
 */
final class AverageLateness implements MetricDefinition
{
    public function key(): string
    {
        return 'average_lateness';
    }

    public function label(): string
    {
        return 'Rata-rata terlambat';
    }

    public function definition(): string
    {
        return 'Total menit terlambat ÷ jumlah hari terlambat dalam periode (dihitung dari batas toleransi shift).';
    }

    public function unit(): string
    {
        return 'minutes';
    }

    public function compute(MetricScope $scope, Period $period): MetricValue
    {
        $row = DB::table('attendance_days')
            ->whereIn('user_id', $scope->userIds)
            ->where('work_date', '>=', $period->startDate())
            ->where('work_date', '<', $period->endDate())
            ->where('late_minutes', '>', 0)
            ->selectRaw('coalesce(sum(late_minutes), 0) as minutes')
            ->selectRaw('count(*) as days')
            ->first();

        return MetricValue::average((float) ($row->minutes ?? 0), (float) ($row->days ?? 0));
    }
}
