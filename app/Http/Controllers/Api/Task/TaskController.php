<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\DeleteTask;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Queries\TugasHariIni;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskStoreRequest;
use App\Http\Requests\Api\TaskUpdateRequest;
use App\Http\Resources\Api\TaskSummary;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Task endpoints of the mobile app. Lists always run through Task::
 * visibleTo / TugasHariIni (invisible workspaces and other people's personal
 * workspaces never appear); the detail route answers 404 through
 * TaskPolicy::view's denyAsNotFound. Writes (Tahap 2 paritas fitur) run the
 * web Actions behind the same policies as the web: create needs
 * WorkspacePolicy::editTasks of the target workspace (superiors assign
 * through workspaces they may edit, exactly like the web create dialog),
 * update/delete follow TaskPolicy (keputusan 9 Okt 2026: a task assigned by
 * someone else only by its creator or a superior).
 */
class TaskController extends Controller
{
    /**
     * "Tugas hari ini": the caller's tasks due today (office date) in three
     * segments — pribadi, tim, semua — plus the counts (dashboard query).
     */
    public function today(#[CurrentUser] User $user, TugasHariIni $query): JsonResponse
    {
        Gate::authorize('viewAny', Task::class);

        return response()->json($query->for($user));
    }

    /**
     * Task list, 20 per page: everything the caller may see, or with
     * `saya=1` only the tasks assigned to them. Due date first (nulls last),
     * then priority and number — the same order as "Tugas saya" on the web.
     */
    public function index(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', Task::class);

        $tasks = Task::query()
            ->visibleTo($user)
            ->when($request->boolean('saya'), fn (Builder $query): Builder => $query->whereExists(
                fn (QueryBuilder $assigned): QueryBuilder => $assigned->selectRaw('1')
                    ->from('task_assignees')
                    ->whereColumn('task_assignees.task_id', 'tasks.id')
                    ->where('task_assignees.user_id', $user->id),
            ))
            ->with(['workspace:id,key,name', 'status:id,name,category', 'assignees:id,name'])
            ->orderByRaw('due_date asc nulls last')
            ->orderBy('priority')
            ->orderBy('number')
            ->paginate(20);

        return response()->json([
            'tasks' => array_map(
                fn (Task $task): array => TaskSummary::make($task),
                $tasks->items(),
            ),
            'meta' => [
                'current_page' => $tasks->currentPage(),
                'from' => $tasks->firstItem(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'to' => $tasks->lastItem(),
                'total' => $tasks->total(),
            ],
        ]);
    }

    /**
     * One task, still compact (policy view; an invisible task is a 404).
     */
    public function show(#[CurrentUser] User $user, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        return response()->json(['task' => TaskSummary::detail($this->load($task))]);
    }

    /**
     * POST /api/v1/tugas: the web CreateTask behind editTasks of the body's
     * `workspace_id`. A workspace the caller cannot see is a 404 (the web
     * route binder hides it the same way), a visible one without edit rights
     * (viewer, archived, non-member internal) is a 403.
     */
    public function store(TaskStoreRequest $request, #[CurrentUser] User $user, CreateTask $createTask): JsonResponse
    {
        $workspace = Workspace::query()->find($request->string('workspace_id')->toString());

        abort_if($workspace === null, 404);

        Gate::authorize('editTasks', $workspace);

        $task = $createTask->handle($workspace, $user, $request->payload());

        return response()->json(['task' => TaskSummary::detail($this->load($task))], 201);
    }

    /**
     * PATCH /api/v1/tugas/{task}: partial update through the web UpdateTask
     * behind TaskPolicy::update.
     */
    public function update(TaskUpdateRequest $request, Task $task, #[CurrentUser] User $user, UpdateTask $updateTask): JsonResponse
    {
        Gate::authorize('update', $task);

        $task = $updateTask->handle($task, $user, $request->payload());

        return response()->json(['task' => TaskSummary::detail($this->load($task))]);
    }

    /**
     * DELETE /api/v1/tugas/{task}: soft delete through the web DeleteTask
     * behind TaskPolicy::delete.
     */
    public function destroy(Task $task, #[CurrentUser] User $user, DeleteTask $deleteTask): JsonResponse
    {
        Gate::authorize('delete', $task);

        $deleteTask->handle($task, $user);

        return response()->json(status: 204);
    }

    /**
     * The relations and checklist counts TaskSummary::detail() reads.
     */
    private function load(Task $task): Task
    {
        return $task->loadMissing([
            'workspace:id,key,name',
            'status:id,name,category',
            'assignees:id,name',
        ])->loadCount([
            'checklistItems',
            'checklistItems as checklist_done_count' => fn (Builder $query): Builder => $query->where('is_done', true),
        ]);
    }
}
