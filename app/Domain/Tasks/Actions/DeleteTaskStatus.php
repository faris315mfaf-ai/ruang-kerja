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
 * ones) to $target. The last column cannot be deleted.
 */
final class DeleteTaskStatus
{
    public function __construct(private readonly TaskPositioner $positioner) {}

    public function handle(TaskStatus $status, ?TaskStatus $target): void
    {
        $remaining = TaskStatus::query()->where('workspace_id', $status->workspace_id)->whereKeyNot($status->id)->count();

        if ($remaining === 0) {
            throw ValidationException::withMessages(['status' => 'Workspace harus punya minimal satu kolom.']);
        }

        $hasTasks = Task::withTrashed()->where('status_id', $status->id)->exists();

        if ($hasTasks && ($target === null || $target->workspace_id !== $status->workspace_id || $target->is($status))) {
            throw ValidationException::withMessages(['target_status_id' => 'Pilih kolom tujuan untuk tugas di kolom ini.']);
        }

        DB::transaction(function () use ($status, $target): void {
            if ($target !== null) {
                $this->positioner->lockColumn($target);
                $now = now();
                $last = Task::withTrashed()->where('status_id', $target->id)->orderByDesc('position')->value('position');
                $position = is_string($last) ? $last : null;
                $tooLong = false;

                // Appended below the target column, keeping their relative order.
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

            $status->delete();
        });
    }
}
