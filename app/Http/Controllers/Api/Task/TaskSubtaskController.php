<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Analytics\Data\Period;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Queries\TaskApiDetail;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SubtaskStoreRequest;
use App\Http\Resources\Api\TaskListRow;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Sub-tasks of a task. Listing needs `view` of the parent; creating one is
 * doing the work on the parent (TaskPolicy::work = the web editTasks rule, so
 * the assignee of a task someone else assigned may break it down) and runs
 * the web CreateTask with `parent_id` — numbering, column, activity on the
 * parent and notifications are the web's.
 */
class TaskSubtaskController extends Controller
{
    public function index(#[CurrentUser] User $user, Task $task, TaskApiDetail $detail): JsonResponse
    {
        Gate::authorize('view', $task);

        $task->loadMissing('workspace:id,key,name,type');

        return response()->json([
            'parent' => ['id' => $task->id, 'key' => $task->displayKey(), 'title' => $task->title],
            'subtasks' => $detail->subtasks($task, Period::officeDate(now())),
        ]);
    }

    public function store(SubtaskStoreRequest $request, Task $task, #[CurrentUser] User $user, CreateTask $createTask): JsonResponse
    {
        Gate::authorize('work', $task);

        $subtask = $createTask->handle($task->workspace, $user, $request->payload($task));

        $subtask = Task::query()
            ->with(['workspace:id,key,name,type', 'status:id,workspace_id,name,category', 'assignees:id,name,avatar_url', 'labels'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query): Builder => $query->where('is_done', true),
            ])
            ->findOrFail($subtask->id);

        return response()->json(['subtask' => TaskListRow::make($subtask, Period::officeDate(now()))], 201);
    }
}
