<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Planner\Services\CompletionTarget;
use App\Domain\Tasks\Actions\MoveTask;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskStatusRequest;
use App\Http\Resources\Api\TaskSummary;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * PATCH /api/v1/tugas/{task}/status: the only write of the mobile task API
 * (Tahap 1). Runs the web MoveTask Action behind TaskPolicy::move, so an
 * assignee may complete their task (the 9 Oct 2026 editing rule only
 * restricts edit/delete, never move). `status_id` targets a column of the
 * task's workspace; `done: true` follows the web "centang selesai" target
 * (first Review column, otherwise Done) and `done: false` reopens into the
 * first open column.
 */
class TaskStatusController extends Controller
{
    public function __construct(private readonly MoveTask $moveTask) {}

    public function __invoke(TaskStatusRequest $request, Task $task, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('move', $task);

        $moved = $this->moveTask->handle($task, $user, $this->target($task, $request));

        $moved->loadMissing(['workspace:id,key,name', 'status:id,name,category', 'assignees:id,name']);

        return response()->json(['task' => TaskSummary::make($moved)]);
    }

    private function target(Task $task, TaskStatusRequest $request): TaskStatus
    {
        if ($request->filled('status_id')) {
            return TaskStatus::query()
                ->where('workspace_id', $task->workspace_id)
                ->findOrFail($request->string('status_id')->toString());
        }

        $columns = TaskStatus::query()
            ->where('workspace_id', $task->workspace_id)
            ->orderBy('position')
            ->orderBy('name')
            ->get();

        return $request->wantsDone()
            ? $this->closeTarget($task, $columns)
            : $this->reopenTarget($task, $columns);
    }

    /**
     * Same rule as the web quick-complete (CompletionTarget): Review first,
     * otherwise Done — with the same Indonesian refusal messages.
     *
     * @param  Collection<int, TaskStatus>  $columns
     */
    private function closeTarget(Task $task, Collection $columns): TaskStatus
    {
        $target = CompletionTarget::resolve($task, $task->workspace, $columns);

        if ($target === null) {
            throw ValidationException::withMessages([
                'done' => $task->isClosed() ? 'Tugas ini sudah selesai.' : 'Workspace ini belum punya kolom Selesai.',
            ]);
        }

        return $target['status'];
    }

    /**
     * done: false — back to the first open column of the workspace.
     *
     * @param  Collection<int, TaskStatus>  $columns
     */
    private function reopenTarget(Task $task, Collection $columns): TaskStatus
    {
        if (! $task->isClosed()) {
            throw ValidationException::withMessages(['done' => 'Tugas ini belum selesai.']);
        }

        return $columns->first(
            fn (TaskStatus $status): bool => ! $status->category->isClosed(),
        ) ?? throw ValidationException::withMessages(['done' => 'Workspace ini belum punya kolom terbuka.']);
    }
}
