<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Models\Task;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Task terlambat = tasks not finished (not done/canceled) whose due date is
 * before today (office calendar). A task due today is not late yet. This is a
 * snapshot at `today`, independent of the period filter.
 */
final class OverdueTasks implements MetricDefinition
{
    public function key(): string
    {
        return 'overdue_tasks';
    }

    public function label(): string
    {
        return 'Tugas terlambat';
    }

    public function definition(): string
    {
        return 'Tugas yang belum selesai (bukan Selesai atau Dibatalkan) dengan tenggat sebelum hari ini.';
    }

    public function unit(): string
    {
        return 'count';
    }

    /**
     * @param  CarbonImmutable  $today  office-local date
     */
    public function compute(MetricScope $scope, CarbonImmutable $today): MetricValue
    {
        return MetricValue::count($this->query($scope, $today)->count());
    }

    /**
     * @return Builder<Task>
     */
    public function query(MetricScope $scope, CarbonImmutable $today): Builder
    {
        return $scope->tasks()
            ->open()
            ->whereNotNull('tasks.due_date')
            ->where('tasks.due_date', '<', $today->toDateString());
    }
}
