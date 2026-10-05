<?php

namespace App\Http\Resources;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Task with resolved relations for cross-workspace screens ("Tugas saya",
 * resources/js/features/tasks/types.ts `TaskRow`). Eager-load `workspace`,
 * `status`, `labels`, `assignees` and `parent:id,number`.
 *
 * @mixin Task
 */
class TaskRowResource extends TaskResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Task $task */
        $task = $this->resource;

        return [
            ...parent::toArray($request),
            'workspace' => WorkspaceResource::reference($task->workspace),
            'status' => TaskStatusResource::make($task->status)->resolve($request),
            'labels' => $task->labels->map(fn (Label $label): array => LabelResource::make($label)->resolve($request))->values()->all(),
            'assignees' => $task->assignees->map(fn (User $user): array => PersonResource::from($user))->values()->all(),
            // First "done" column of the workspace (quick "Selesai" action), when statuses are loaded.
            'done_status_id' => $task->workspace->relationLoaded('statuses')
                ? $task->workspace->statuses->first(fn (TaskStatus $status): bool => $status->category === TaskStatusCategory::Done)?->id
                : null,
        ];
    }
}
