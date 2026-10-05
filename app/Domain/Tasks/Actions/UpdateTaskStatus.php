<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\TaskLifecycle;
use App\Models\Task;
use App\Models\TaskStatus;
use Illuminate\Support\Facades\DB;

/**
 * Renames/recolors a column or changes its category. A new category is
 * applied to every task in the column (status_category, completed_at, …) so
 * metrics stay correct.
 */
final class UpdateTaskStatus
{
    /**
     * @param  array{name?: string, category?: TaskStatusCategory, color?: string}  $changes
     */
    public function handle(TaskStatus $status, array $changes): TaskStatus
    {
        return DB::transaction(function () use ($status, $changes): TaskStatus {
            $status->fill($changes);
            $categoryChanged = $status->isDirty('category');
            $status->save();

            if ($categoryChanged) {
                $now = now();

                Task::query()
                    ->where('status_id', $status->id)
                    ->lockForUpdate()
                    ->get()
                    ->each(function (Task $task) use ($status, $now): void {
                        TaskLifecycle::apply($task, $status, $now);
                        $task->save();
                    });
            }

            return $status;
        });
    }
}
