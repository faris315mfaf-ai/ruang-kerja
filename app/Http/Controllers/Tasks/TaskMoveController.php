<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Tasks\Queries\BoardTasks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tasks\MoveTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

/**
 * PATCH /tugas/{task}/move (docs/ARCHITECTURE.md §3.5). The board applies the
 * move optimistically and rolls back when this fails.
 */
class TaskMoveController extends Controller
{
    public function __invoke(MoveTaskRequest $request, Task $task, #[CurrentUser] User $user, MoveTask $moveTask): JsonResponse|RedirectResponse
    {
        Gate::authorize('move', $task);

        $status = TaskStatus::query()->where('workspace_id', $task->workspace_id)->findOrFail($request->string('status_id')->toString());
        $afterId = $request->filled('after_id') ? $request->string('after_id')->toString() : null;
        $beforeId = $request->filled('before_id') ? $request->string('before_id')->toString() : null;

        $moved = $moveTask->handle($task, $user, $status, $afterId, $beforeId);

        if (! $request->expectsJson()) {
            return back();
        }

        $fresh = BoardTasks::query($user)->whereKey($moved->id)->firstOrFail();

        return response()->json(['task' => (new TaskResource($fresh))->resolve()]);
    }
}
