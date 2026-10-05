<?php

namespace App\Domain\Analytics\MetricDefinitions;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use Carbon\CarbonImmutable;

/**
 * Beban kerja = open tasks per person (and total estimated hours when filled
 * in). A task with several assignees counts for each of them. Snapshot at
 * `today`; `overdue` is the part of `open` that is late (OverdueTasks rule).
 */
final class Workload implements MetricDefinition
{
    public function key(): string
    {
        return 'workload';
    }

    public function label(): string
    {
        return 'Beban kerja';
    }

    public function definition(): string
    {
        return 'Jumlah tugas terbuka per orang (dan total estimasi jam bila diisi). Tugas dengan beberapa penanggung jawab dihitung untuk masing-masing.';
    }

    public function unit(): string
    {
        return 'count';
    }

    /**
     * One row per user in scope (zero rows included), keyed by user id.
     *
     * @return array<string, array{open: int, overdue: int, estimate_hours: float|null}>
     */
    public function compute(MetricScope $scope, CarbonImmutable $today): array
    {
        $rows = $scope->visibleTasks()
            ->toBase()
            ->join('task_assignees', 'task_assignees.task_id', '=', 'tasks.id')
            ->whereIn('task_assignees.user_id', $scope->userIds)
            ->whereNotIn('tasks.status_category', TaskStatusCategory::closedValues())
            ->selectRaw('task_assignees.user_id')
            ->selectRaw('count(*) as open')
            ->selectRaw('count(*) filter (where tasks.due_date < ?) as overdue', [$today->toDateString()])
            ->selectRaw('sum(tasks.estimate_hours) as estimate_hours')
            ->groupBy('task_assignees.user_id')
            ->get()
            ->keyBy('user_id');

        $result = [];

        foreach ($scope->userIds as $userId) {
            $row = $rows->get($userId);
            $result[$userId] = [
                'open' => (int) ($row->open ?? 0),
                'overdue' => (int) ($row->overdue ?? 0),
                'estimate_hours' => isset($row->estimate_hours) ? round((float) $row->estimate_hours, 1) : null,
            ];
        }

        return $result;
    }
}
