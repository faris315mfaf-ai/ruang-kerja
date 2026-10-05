<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Support\PeriodBuckets;
use App\Domain\Attendance\Enums\AttendanceStatus;
use Illuminate\Support\Facades\DB;

/**
 * Tingkat kehadiran = attended person-days ÷ scheduled person-days
 * (Dashboard Manajemen "Kehadiran rata-rata", "228 dari 240 hari-orang").
 *
 * - Scheduled work day: the same definition as AttendanceDiscipline (a row
 *   with a shift snapshot whose status is not holiday / leave / sick / permit /
 *   business trip).
 * - Attended: AttendanceStatus::isAttended() (present, late, early leave, WFH)
 *   plus "perlu koreksi" days that do have a check-in — the same rule as the
 *   monthly recap's "Hadir" (MonthlyRecap). Late days count as attended; the
 *   punctuality view is AttendanceDiscipline.
 */
final class AttendanceRate implements MetricDefinition
{
    public function key(): string
    {
        return 'attendance_rate';
    }

    public function label(): string
    {
        return 'Tingkat kehadiran';
    }

    public function definition(): string
    {
        return 'Hari-orang hadir (termasuk terlambat, pulang cepat, dan WFH) ÷ hari-orang terjadwal, tidak termasuk libur, cuti, izin, sakit, dan dinas.';
    }

    public function unit(): string
    {
        return 'percent';
    }

    public function compute(MetricScope $scope, Period $period): MetricValue
    {
        return $this->series($scope, [$period])[0];
    }

    /**
     * @param  list<Period>  $periods
     * @return list<MetricValue>
     */
    public function series(MetricScope $scope, array $periods): array
    {
        if ($periods === []) {
            return [];
        }

        [$bucket, $bindings] = PeriodBuckets::caseExpression('work_date', $periods, dateColumn: true);
        [$from, $to] = PeriodBuckets::bounds($periods, dateColumn: true);
        $excused = array_map(fn (AttendanceStatus $status): string => $status->value, AttendanceDiscipline::EXCUSED);
        $attended = array_values(array_map(
            fn (AttendanceStatus $status): string => $status->value,
            array_filter(AttendanceStatus::cases(), fn (AttendanceStatus $status): bool => $status->isAttended()),
        ));
        $scheduled = 'shift_id is not null and status not in ('.implode(', ', array_fill(0, count($excused), '?')).')';
        $attendedIn = implode(', ', array_fill(0, count($attended), '?'));

        $rows = DB::table('attendance_days')
            ->whereIn('user_id', $scope->userIds)
            ->where('work_date', '>=', $from)
            ->where('work_date', '<', $to)
            ->selectRaw($bucket.' as bucket', $bindings)
            ->selectRaw(
                'count(*) filter (where '.$scheduled.' and (status in ('.$attendedIn.') or (status = ? and check_in_at is not null))) as attended',
                [...$excused, ...$attended, AttendanceStatus::NeedsCorrection->value],
            )
            ->selectRaw('count(*) filter (where '.$scheduled.') as scheduled', $excused)
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        $values = [];

        foreach (array_keys($periods) as $index) {
            $row = $rows->get($index);
            $values[] = MetricValue::percentage((float) ($row->attended ?? 0), (float) ($row->scheduled ?? 0));
        }

        return $values;
    }
}
