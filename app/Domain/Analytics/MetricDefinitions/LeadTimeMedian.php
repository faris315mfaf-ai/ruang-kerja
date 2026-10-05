<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Tasks\Enums\TaskStatusCategory;

/**
 * Lead time = median(completed_at − created_at) of tasks in category `done`
 * completed in the period (PRD M7). Value in days (fractional);
 * `numerator`/`denominator` hold the sample size.
 */
final class LeadTimeMedian implements MetricDefinition
{
    public function key(): string
    {
        return 'lead_time';
    }

    public function label(): string
    {
        return 'Lead time (median)';
    }

    public function definition(): string
    {
        return 'Median waktu dari tugas dibuat sampai selesai, untuk tugas yang selesai dalam periode.';
    }

    public function unit(): string
    {
        return 'days';
    }

    public function compute(MetricScope $scope, Period $period): MetricValue
    {
        $row = $scope->tasks()
            ->toBase()
            ->where('tasks.status_category', TaskStatusCategory::Done->value)
            ->where('tasks.completed_at', '>=', $period->startUtc()->toIso8601String())
            ->where('tasks.completed_at', '<', $period->endUtc()->toIso8601String())
            ->selectRaw('percentile_cont(0.5) within group (order by extract(epoch from (tasks.completed_at - tasks.created_at))) as median_seconds')
            ->selectRaw('count(*) as total')
            ->first();

        $total = (int) ($row->total ?? 0);
        $median = $row->median_seconds ?? null;

        return new MetricValue($total > 0 && $median !== null ? max(0.0, (float) $median) / 86400 : null, $total, $total);
    }
}
