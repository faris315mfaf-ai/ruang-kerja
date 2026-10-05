<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Queries\TaskDetail;
use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Task detail: JSON for the TaskSheet / Inbox preview (GET /tugas/{task})
 * and the full-screen page /w/{KEY}/tasks/{number} (also the mobile
 * MTaskDetail and search/notification deep links).
 */
class TaskDetailController extends Controller
{
    public function show(Task $task, #[CurrentUser] User $user, TaskDetail $detail): JsonResponse
    {
        Gate::authorize('view', $task);

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
            'today' => now(config()->string('app.office_timezone'))->toDateString(),
        ]);
    }
}
