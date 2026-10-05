<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Support\PeriodBuckets;
use App\Domain\Attendance\Enums\AttendanceStatus;
use Illuminate\Support\Facades\DB;

/**
 * Kedisiplinan hadir = on-time attended days ÷ scheduled work days (PRD M7),
 * following the reference query of DATABASE §10:
 *
 * - scheduled work day: an `attendance_days` row with a shift snapshot whose
 *   status is not holiday / leave / sick / permit / business trip;
 * - on time: status `present` or `wfh` (late, early leave, alpha and
 *   "perlu koreksi" are scheduled days that are not on time).
 *
 * The numerator is limited to scheduled days too, so the rate never exceeds
 * 100% when someone checks in on an unscheduled day. Days without a row (today
 * before check-in) are not counted.
 */
final class AttendanceDiscipline implements MetricDefinition
{
    public const array EXCUSED = [
        AttendanceStatus::Holiday,
        AttendanceStatus::Leave,
        AttendanceStatus::Sick,
        AttendanceStatus::Permit,
        AttendanceStatus::BusinessTrip,
    ];

    public const array ON_TIME = [AttendanceStatus::Present, AttendanceStatus::Wfh];

    /** A scheduled work day (one placeholder per EXCUSED status). */
    private const string SCHEDULED = 'shift_id is not null and status not in (?, ?, ?, ?, ?)';

    public function key(): string
    {
        return 'attendance_discipline';
    }

    public function label(): string
    {
        return 'Kedisiplinan hadir';
    }

    public function definition(): string
    {
        return 'Hari hadir tepat waktu (Hadir atau WFH) ÷ hari kerja terjadwal, tidak termasuk libur, cuti, izin, sakit, dan dinas.';
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
        $excused = array_map(fn (AttendanceStatus $status): string => $status->value, self::EXCUSED);
        $onTime = array_map(fn (AttendanceStatus $status): string => $status->value, self::ON_TIME);

        $rows = DB::table('attendance_days')
            ->whereIn('user_id', $scope->userIds)
            ->where('work_date', '>=', $from)
            ->where('work_date', '<', $to)
            ->selectRaw($bucket.' as bucket', $bindings)
            ->selectRaw('count(*) filter (where '.self::SCHEDULED.' and status in (?, ?)) as on_time', [...$excused, ...$onTime])
            ->selectRaw('count(*) filter (where '.self::SCHEDULED.') as scheduled', $excused)
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        $values = [];

        foreach (array_keys($periods) as $index) {
            $row = $rows->get($index);
            $values[] = MetricValue::percentage((float) ($row->on_time ?? 0), (float) ($row->scheduled ?? 0));
        }

        return $values;
    }
}
