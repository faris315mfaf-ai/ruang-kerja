<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Support\PeriodBuckets;
use App\Domain\Tasks\Enums\TaskStatusCategory;

/**
 * Ketepatan waktu = tasks completed on or before their due date ÷ tasks
 * completed (in the period) that have a due date (PRD M7, DATABASE §10).
 *
 * The completion instant is converted to the office calendar day before the
 * comparison: finishing at 23.30 WIB on the due date is on time.
 */
final class OnTimeRate implements MetricDefinition
{
    public function key(): string
    {
        return 'on_time_rate';
    }

    public function label(): string
    {
        return 'Ketepatan waktu';
    }

    public function definition(): string
    {
        return 'Tugas yang selesai pada atau sebelum tenggat ÷ tugas yang selesai dalam periode dan punya tenggat.';
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

        [$bucket, $bindings] = PeriodBuckets::caseExpression('tasks.completed_at', $periods, dateColumn: false);
        [$from, $to] = PeriodBuckets::bounds($periods, dateColumn: false);

        $rows = $scope->tasks()
            ->toBase()
            ->where('tasks.status_category', TaskStatusCategory::Done->value)
            ->whereNotNull('tasks.due_date')
            ->where('tasks.completed_at', '>=', $from)
            ->where('tasks.completed_at', '<', $to)
            ->selectRaw($bucket.' as bucket', $bindings)
            ->selectRaw('count(*) filter (where (tasks.completed_at at time zone ?)::date <= tasks.due_date) as on_time', [config()->string('app.office_timezone')])
            ->selectRaw('count(*) as total')
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        $values = [];

        foreach (array_keys($periods) as $index) {
            $row = $rows->get($index);
            $values[] = MetricValue::percentage((float) ($row->on_time ?? 0), (float) ($row->total ?? 0));
        }

        return $values;
    }
}
