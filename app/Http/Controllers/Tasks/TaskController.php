<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\DeleteTask;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Queries\BoardTasks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tasks\TaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Create (quick create & full form), update and delete tasks. Inertia visits
 * get a redirect back with a toast; JSON callers get the task.
 */
class TaskController extends Controller
{
    public function store(TaskRequest $request, Workspace $workspace, #[CurrentUser] User $user, CreateTask $createTask): RedirectResponse|JsonResponse
    {
        Gate::authorize('editTasks', $workspace);

        $payload = $request->payload();
        $task = $createTask->handle($workspace, $user, [...$payload, 'title' => $payload['title'] ?? '']);

        if ($request->expectsJson()) {
            return response()->json(['task' => $this->present($task)], 201);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => "Tugas {$task->displayKey()} dibuat."]);

        return back();
    }

    public function update(TaskRequest $request, Task $task, #[CurrentUser] User $user, UpdateTask $updateTask): RedirectResponse|JsonResponse
    {
        Gate::authorize('update', $task);

        $task = $updateTask->handle($task, $user, $request->payload());

        if ($request->expectsJson()) {
            return response()->json(['task' => $this->present($task)]);
        }

        return back();
    }

    public function destroy(Request $request, Task $task, #[CurrentUser] User $user, DeleteTask $deleteTask): RedirectResponse|JsonResponse
    {
        Gate::authorize('delete', $task);

        $key = $task->displayKey();
        $deleteTask->handle($task, $user);

        if ($request->expectsJson()) {
            return response()->json(status: 204);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => "Tugas {$key} dihapus."]);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Task $task): array
    {
        $fresh = BoardTasks::query()->whereKey($task->id)->firstOrFail();

        return (new TaskResource($fresh))->resolve();
    }
}
