<?php

namespace App\Domain\Analytics\Projects;

/**
 * Task aggregates of one project workspace — the input of ActualProgress.
 * Canceled and soft-deleted tasks are never part of the scope.
 */
final readonly class TaskTotals
{
    public function __construct(
        /** Tasks that are not canceled (the scope). */
        public int $scope = 0,
        /** Scope tasks in a `done` column. */
        public int $done = 0,
        /** Scope tasks with estimate_hours > 0. */
        public int $estimated = 0,
        /** Sum of estimate_hours over the scope. */
        public float $estimatedHours = 0.0,
        /** Done tasks with an estimate. */
        public int $doneEstimated = 0,
        /** Sum of estimate_hours over done tasks. */
        public float $doneEstimatedHours = 0.0,
        /** Open tasks with due_date before today. */
        public int $overdue = 0,
    ) {}

    /**
     * Builds totals from individual tasks (tests, small lists).
     *
     * @param  iterable<array{category: string, estimate_hours?: float|int|string|null, overdue?: bool}>  $tasks
     */
    public static function fromTasks(iterable $tasks): self
    {
        $scope = $done = $estimated = $doneEstimated = $overdue = 0;
        $hours = $doneHours = 0.0;

        foreach ($tasks as $task) {
            if ($task['category'] === 'canceled') {
                continue;
            }

            $scope++;
            $isDone = $task['category'] === 'done';
            $estimate = (float) ($task['estimate_hours'] ?? 0);

            if ($isDone) {
                $done++;
            }

            if ($estimate > 0) {
                $estimated++;
                $hours += $estimate;

                if ($isDone) {
                    $doneEstimated++;
                    $doneHours += $estimate;
                }
            }

            if (($task['overdue'] ?? false) && ! $isDone) {
                $overdue++;
            }
        }

        return new self($scope, $done, $estimated, $hours, $doneEstimated, $doneHours, $overdue);
    }
}
