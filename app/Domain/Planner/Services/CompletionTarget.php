<?php

namespace App\Domain\Planner\Services;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\Workspace;
use Illuminate\Support\Collection;

/**
 * Where "centang selesai" in Ruang saya moves a task (owner decision): to
 * the first Review column when the workspace has one and the task is not in
 * review yet ("Kirim ke Review"), otherwise to the first Done column. A
 * personal workspace has nobody to review, so it always goes to Done.
 */
final class CompletionTarget
{
    public const string REVIEW = 'review';

    public const string DONE = 'done';

    /**
     * @param  iterable<TaskStatus>  $columns  the workspace's columns (any order; position decides)
     * @return array{status: TaskStatus, outcome: string}|null null when closed or no Done column
     */
    public static function resolve(Task $task, Workspace $workspace, iterable $columns): ?array
    {
        if ($task->isClosed()) {
            return null;
        }

        $ordered = Collection::make($columns)->sortBy(fn (TaskStatus $status): string => $status->position, SORT_STRING)->values();

        if (! $workspace->isPersonal() && $task->status_category !== TaskStatusCategory::Review) {
            $review = $ordered->first(fn (TaskStatus $status): bool => $status->category === TaskStatusCategory::Review);

            if ($review !== null) {
                return ['status' => $review, 'outcome' => self::REVIEW];
            }
        }

        $done = $ordered->first(fn (TaskStatus $status): bool => $status->category === TaskStatusCategory::Done);

        return $done !== null ? ['status' => $done, 'outcome' => self::DONE] : null;
    }
}
