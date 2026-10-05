<?php

namespace App\Domain\Tasks\Services;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\TaskStatus;
use Carbon\CarbonImmutable;

/**
 * Keeps the denormalized status fields of a task in sync with its column:
 * status_category, started_at (first time in progress/review), completed_at
 * (set entering done, cleared leaving it) and canceled_at (same for canceled).
 */
final class TaskLifecycle
{
    public static function apply(Task $task, TaskStatus $status, CarbonImmutable $now): void
    {
        $category = $status->category;

        $task->status_id = $status->id;
        $task->status_category = $category;

        if ($category->isStarted() && $task->started_at === null) {
            $task->started_at = $now;
        }

        if ($category === TaskStatusCategory::Done) {
            $task->completed_at ??= $now;
        } else {
            $task->completed_at = null;
        }

        if ($category === TaskStatusCategory::Canceled) {
            $task->canceled_at ??= $now;
        } else {
            $task->canceled_at = null;
        }
    }
}
