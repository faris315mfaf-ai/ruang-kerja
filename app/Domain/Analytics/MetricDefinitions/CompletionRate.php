<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Support\PeriodBuckets;
use App\Domain\Tasks\Enums\TaskStatusCategory;

/**
 * Tingkat penyelesaian = tasks in category `done` with a due date in the
 * period ÷ all tasks with a due date in the period (PRD M7).
 *
 * Canceled tasks are not work to be finished and are left out of both sides.
 * Sub-tasks count like any task. "Done" is the task's current category.
 */
final class CompletionRate implements MetricDefinition
{
    public function key(): string
    {
        return 'completion_rate';
    }

    public function label(): string
    {
        return 'Tingkat penyelesaian';
    }

    public function definition(): string
    {
        return 'Tugas berstatus Selesai dengan tenggat dalam periode ÷ semua tugas bertenggat dalam periode (tugas dibatalkan tidak dihitung).';
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
     * @return list<MetricValue> one value per period, same order
     */
    public function series(MetricScope $scope, array $periods): array
    {
        if ($periods === []) {
            return [];
        }

        [$bucket, $bindings] = PeriodBuckets::caseExpression('tasks.due_date', $periods, dateColumn: true);
        [$from, $to] = PeriodBuckets::bounds($periods, dateColumn: true);

        $rows = $scope->tasks()
            ->toBase()
            ->where('tasks.status_category', '!=', TaskStatusCategory::Canceled->value)
            ->where('tasks.due_date', '>=', $from)
            ->where('tasks.due_date', '<', $to)
            ->selectRaw($bucket.' as bucket', $bindings)
            ->selectRaw('count(*) filter (where tasks.status_category = ?) as done', [TaskStatusCategory::Done->value])
            ->selectRaw('count(*) as total')
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        $values = [];

        foreach (array_keys($periods) as $index) {
            $row = $rows->get($index);
            $values[] = MetricValue::percentage((float) ($row->done ?? 0), (float) ($row->total ?? 0));
        }

        return $values;
    }
}
