<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Queries\TugasHariIni;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\TaskSummary;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Read-only task endpoints of the mobile app (Tahap 1). Lists always run
 * through Task::visibleTo / TugasHariIni (invisible workspaces and other
 * people's personal workspaces never appear); the detail route answers 404
 * through TaskPolicy::view's denyAsNotFound. Creating, editing and deleting
 * tasks stay on the web for now (keputusan Tahap 1: assignment by superiors
 * is a web flow).
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

        $task->loadMissing([
            'workspace:id,key,name',
            'status:id,name,category',
            'assignees:id,name',
        ])->loadCount([
            'checklistItems',
            'checklistItems as checklist_done_count' => fn (Builder $query): Builder => $query->where('is_done', true),
        ]);

        return response()->json(['task' => TaskSummary::detail($task)]);
    }
}
