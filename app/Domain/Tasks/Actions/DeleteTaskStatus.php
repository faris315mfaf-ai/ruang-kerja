<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Domain\Tasks\Services\TaskLifecycle;
use App\Domain\Tasks\Services\TaskPositioner;
use App\Models\Task;
use App\Models\TaskStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Deletes a column after moving its tasks (including archived/soft-deleted
 * ones) to $target. The last column cannot be deleted. Checks run inside the
 * transaction after locking the workspace's columns (no race with a task
 * created/moved into the column or a parallel column delete).
 */
final class DeleteTaskStatus
{
    public function __construct(private readonly TaskPositioner $positioner) {}

    public function handle(TaskStatus $status, ?TaskStatus $target): void
    {
        DB::transaction(function () use ($status, $target): void {
            // Lock every column of the workspace first (fixed order, no deadlock):
            // creating or moving a task locks its column, so nobody can drop a
            // task into this column — or delete the other last column — while
            // we check and move.
            $columns = TaskStatus::query()
                ->where('workspace_id', $status->workspace_id)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if (! $columns->has($status->id)) {
                return; // Deleted meanwhile.
            }

            if ($columns->count() === 1) {
                throw ValidationException::withMessages(['status' => 'Workspace harus punya minimal satu kolom.']);
            }

            $hasTasks = Task::withTrashed()->where('status_id', $status->id)->exists();

            if ($hasTasks && ($target === null || ! $columns->has($target->id) || $target->is($status))) {
                throw ValidationException::withMessages(['target_status_id' => 'Pilih kolom tujuan untuk tugas di kolom ini.']);
            }

            if ($hasTasks) {
                $this->moveTasks($status, $target);
            }

            $status->delete();
        });
    }

    /**
     * Appends the column's tasks below the target column, keeping their order.
     */
    private function moveTasks(TaskStatus $status, TaskStatus $target): void
    {
        $now = now();
        $last = Task::withTrashed()->where('status_id', $target->id)->orderByDesc('position')->value('position');
        $position = is_string($last) ? $last : null;
        $tooLong = false;

        Task::withTrashed()
            ->where('status_id', $status->id)
            ->orderBy('position')
            ->orderBy('number')
            ->get()
            ->each(function (Task $task) use ($target, $now, &$position, &$tooLong): void {
                $position = Lexorank::between($position, null);
                $tooLong = $tooLong || strlen($position) > Lexorank::MAX_LENGTH;
                TaskLifecycle::apply($task, $target, $now);
                $task->position = $position;
                $task->save();
            });

        if ($tooLong) {
            $this->positioner->rebalance($target);
        }
    }
}
