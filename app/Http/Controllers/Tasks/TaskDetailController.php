<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Queries\BoardTasks;
use App\Domain\Tasks\Queries\TaskDetail;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Task detail: JSON for the TaskSheet / Inbox preview (GET /tugas/{task})
 * and the full-screen page /w/{KEY}/tasks/{number} (also the mobile
 * MTaskDetail and search/notification deep links).
 *
 * `GET /tugas/{task}?view=card` returns only the board card shape; the board
 * refetches it after a (thin) realtime task event.
 */
class TaskDetailController extends Controller
{
    public function show(Task $task, Request $request, #[CurrentUser] User $user, TaskDetail $detail): JsonResponse
    {
        Gate::authorize('view', $task);

        if ($request->query('view') === 'card') {
            return response()->json(['task' => (new TaskResource(BoardTasks::query($user)->findOrFail($task->id)))->resolve()]);
        }

        return response()->json($detail->for($task, $user));
    }

    public function page(Workspace $workspace, int $number, #[CurrentUser] User $user, TaskDetail $detail): Response
    {
        Gate::authorize('view', $workspace);

        $task = Task::query()->where('workspace_id', $workspace->id)->where('number', $number)->firstOrFail();
        $task->setRelation('workspace', $workspace);

        Gate::authorize('view', $task);

        return Inertia::render('tasks/show', [
            'detail' => $detail->for($task, $user),
            'today' => now(CurrentCompany::timezone())->toDateString(),
        ]);
    }
}
