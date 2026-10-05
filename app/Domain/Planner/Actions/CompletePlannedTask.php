<?php

namespace App\Domain\Planner\Actions;

use App\Domain\Planner\Services\CompletionTarget;
use App\Domain\Tasks\Actions\MoveTask;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * "Centang selesai" in Ruang saya: moves the task to Review ("Kirim ke
 * Review") or Done (CompletionTarget) through MoveTask, so the activity log,
 * realtime broadcast, notifications and completed_at follow the same path
 * as the board. Also accepts a new assignment (seen_at). Returns the
 * previous column for "Urungkan".
 */
final class CompletePlannedTask
{
    public function __construct(private readonly MoveTask $moveTask) {}

    /**
     * @return array{task: Task, outcome: string, previous_status_id: string}
     */
    public function handle(User $actor, Task $task): array
    {
        $task->loadMissing(['workspace', 'status']);
        $columns = TaskStatus::query()->where('workspace_id', $task->workspace_id)->get();
        $target = CompletionTarget::resolve($task, $task->workspace, $columns);

        if ($target === null) {
            throw ValidationException::withMessages([
                'task' => $task->isClosed() ? 'Tugas ini sudah selesai.' : 'Workspace ini belum punya kolom Selesai.',
            ]);
        }

        $previous = $task->status_id;
        $moved = $this->moveTask->handle($task, $actor, $target['status']);

        // Completing a new assignment also accepts it (it leaves "tugas baru").
        $plan = TaskPlan::query()->ownedBy($actor)->where('task_id', $task->id)->first()
            ?? new TaskPlan(['user_id' => $actor->id, 'task_id' => $task->id]);
        $plan->seen_at ??= now()->toImmutable();
        $plan->save();

        return [
            'task' => $moved,
            'outcome' => $target['outcome'],
            'previous_status_id' => $previous,
        ];
    }
}
