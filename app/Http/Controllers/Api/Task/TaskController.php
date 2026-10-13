<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Analytics\Data\Period;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\DeleteTask;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Queries\MyTaskList;
use App\Domain\Tasks\Queries\TaskApiDetail;
use App\Domain\Tasks\Queries\TugasHariIni;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskIndexRequest;
use App\Http\Requests\Api\TaskStoreRequest;
use App\Http\Requests\Api\TaskUpdateRequest;
use App\Http\Resources\Api\TaskListRow;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Task endpoints of the mobile app. Lists always run through Task::
 * visibleTo / MyTasks (invisible workspaces and other people's personal
 * workspaces never appear); the detail route answers 404 through
 * TaskPolicy::view's denyAsNotFound. Writes run the web Actions behind the
 * same policies as the web: create needs WorkspacePolicy::editTasks of the
 * target workspace (superiors assign through workspaces they may edit,
 * exactly like the web create dialog), update/delete follow TaskPolicy
 * (keputusan 9 Okt 2026: a task assigned by someone else only by its
 * creator or a superior). Detail and every write answer with the same full
 * payload (TaskApiDetail), including the fresh `can` of the caller.
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
     * Task list ("Tugas saya"), 20 per page by default: everything the caller
     * may see, or with `scope`/`saya=1` the MyTasks tabs (ditugaskan · saya-amati
     * · saya-buat), filtered (workspace, prioritas, status, label, penanggung,
     * tenggat, q), sorted (tenggat default) and always ended by the task id —
     * a unique tiebreak so pages never repeat or skip a row. Lists hold open
     * tasks plus tasks completed since Monday (office week) unless
     * `selesai=tidak`. Each row carries its due-date `group` hint and the
     * caller's own planner lane; `meta` carries the per-scope counts and the
     * header summary of the chosen scope.
     */
    public function index(TaskIndexRequest $request, #[CurrentUser] User $user, MyTaskList $list): JsonResponse
    {
        Gate::authorize('viewAny', Task::class);

        $criteria = $request->criteria();
        $today = Period::officeDate(now());

        $tasks = $list->query($user, $criteria, $today)
            ->with(['workspace:id,key,name,type', 'status:id,workspace_id,name,category', 'assignees:id,name,avatar_url', 'labels'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query): Builder => $query->where('is_done', true),
            ])
            ->paginate($request->perPage());

        $plans = TaskPlan::query()
            ->ownedBy($user)
            ->whereIn('task_id', array_map(fn (Task $task): string => $task->id, $tasks->items()))
            ->get()
            ->keyBy('task_id');

        return response()->json([
            'tasks' => array_map(
                fn (Task $task): array => TaskListRow::make($task, $today, $plans->get($task->id)),
                $tasks->items(),
            ),
            'meta' => [
                'current_page' => $tasks->currentPage(),
                'from' => $tasks->firstItem(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'to' => $tasks->lastItem(),
                'total' => $tasks->total(),
                'scope' => ['assigned' => 'ditugaskan', 'watching' => 'saya-amati', 'created' => 'saya-buat'][$criteria['scope'] ?? ''] ?? null,
                'today' => $today->toDateString(),
                'counts' => $list->counts($user),
                'summary' => $list->summary($user, $criteria['scope'], $today),
            ],
        ]);
    }

    /**
     * One task with everything the detail screen shows (policy view; an
     * invisible task is a 404).
     */
    public function show(#[CurrentUser] User $user, Task $task, TaskApiDetail $detail): JsonResponse
    {
        Gate::authorize('view', $task);

        return response()->json($detail->for($task, $user));
    }

    /**
     * POST /api/v1/tugas: the web CreateTask behind editTasks of the body's
     * `workspace_id`. A workspace the caller cannot see is a 404 (the web
     * route binder hides it the same way), a visible one without edit rights
     * (viewer, archived, non-member internal) is a 403.
     */
    public function store(TaskStoreRequest $request, #[CurrentUser] User $user, CreateTask $createTask, TaskApiDetail $detail): JsonResponse
    {
        // ULIDs are stored lowercase; the app may send the canonical uppercase form.
        $workspace = Workspace::query()->find(strtolower($request->string('workspace_id')->toString()));

        abort_if($workspace === null, 404);

        Gate::authorize('editTasks', $workspace);

        $task = $createTask->handle($workspace, $user, $request->payload());

        return response()->json($detail->for($task, $user), 201);
    }

    /**
     * PATCH /api/v1/tugas/{task}: partial update through the web UpdateTask
     * behind TaskPolicy::update. The answer is the full detail, so `can` is
     * fresh (e.g. assigning someone else closes the task to bystanders).
     */
    public function update(TaskUpdateRequest $request, Task $task, #[CurrentUser] User $user, UpdateTask $updateTask, TaskApiDetail $detail): JsonResponse
    {
        Gate::authorize('update', $task);

        $task = $updateTask->handle($task, $user, $request->payload());

        return response()->json($detail->for($task, $user));
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
}
