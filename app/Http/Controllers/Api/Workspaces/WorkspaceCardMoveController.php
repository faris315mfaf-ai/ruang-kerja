<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Tasks\Queries\BoardTasks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\WorkspaceCardMoveRequest;
use App\Http\Resources\Api\WorkspaceCard;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * PATCH /api/v1/workspace/{workspace}/papan/kartu/{task} — move a card to a
 * column, between two neighbours (web MoveTask behind TaskPolicy::move, so
 * viewers, archived workspaces and view-only management get 403 and a task of
 * another workspace is a 404). Answers with the moved card and the fresh
 * order of the target column (the cards the board shows there), so the app
 * can replace the column without refetching the whole board.
 */
class WorkspaceCardMoveController extends Controller
{
    public function __invoke(WorkspaceCardMoveRequest $request, Workspace $workspace, Task $task, #[CurrentUser] User $user, MoveTask $moveTask, WorkspacePolicy $policy): JsonResponse
    {
        abort_unless($task->workspace_id === $workspace->id, 404);
        Gate::authorize('move', $task);

        $status = TaskStatus::query()->where('workspace_id', $workspace->id)->findOrFail($request->string('status_id')->toString());
        $afterId = $request->filled('after_id') ? $request->string('after_id')->toString() : null;
        $beforeId = $request->filled('before_id') ? $request->string('before_id')->toString() : null;

        $moved = $moveTask->handle($task, $user, $status, $afterId, $beforeId);

        $canMove = $policy->canEditTasks($user, $workspace);
        $since = now()->subDays(BoardTasks::CLOSED_DAYS);

        $column = BoardTasks::query($user)
            ->with('assignees:id,name')
            ->where('tasks.workspace_id', $workspace->id)
            ->where('tasks.status_id', $status->id)
            ->when($status->category->isClosed(), fn (Builder $closed) => $closed->where(fn (Builder $window) => $window
                ->where('tasks.completed_at', '>=', $since)
                ->orWhere('tasks.canceled_at', '>=', $since)))
            ->orderBy('tasks.position')
            ->orderBy('tasks.number')
            ->get();

        $card = $column->firstWhere('id', $moved->id)
            ?? BoardTasks::query($user)->with('assignees:id,name')->whereKey($moved->id)->firstOrFail();

        return response()->json([
            'task' => WorkspaceCard::make($card, $canMove),
            'column' => [
                'id' => $status->id,
                'name' => $status->name,
                'kategori' => $status->category->value,
                'color' => $status->color,
                'posisi' => $status->position,
                'tasks' => $column->map(fn (Task $task): array => WorkspaceCard::make($task, $canMove))->values()->all(),
            ],
            'message' => "{$moved->displayKey()} dipindah ke {$status->name}.",
        ]);
    }
}
