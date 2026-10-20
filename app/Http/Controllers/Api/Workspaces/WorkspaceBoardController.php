<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Tasks\Queries\BoardTasks;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\WorkspaceAccess;
use App\Http\Resources\Api\WorkspaceCard;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/workspace/{workspace}/papan — the board of a workspace for the
 * mobile app: the columns of the workspace (statuses, ordered) with their
 * cards, the same BoardTasks query the web board renders (open tasks + closed
 * ones of the last 30 days, checklist counts and the viewer's comment badge,
 * no N+1) presented by the web TaskResource. Only workspaces visible to the
 * caller resolve (the {workspace} binder answers 404 first).
 *
 * Besides the columns the answer carries what the screen needs without more
 * round trips: `can` (the web workspace abilities), `read_only` (archived /
 * lihat saja / viewer, with the banner text), the workspace labels and the
 * member count. Every card has `can.move`.
 */
class WorkspaceBoardController extends Controller
{
    public function __construct(private readonly BoardTasks $boardTasks) {}

    public function __invoke(Workspace $workspace, #[CurrentUser] User $user, WorkspacePolicy $policy): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $canMove = $policy->canEditTasks($user, $workspace);

        /** @var Collection<string, Collection<int, Task>> $tasks */
        $tasks = $this->boardTasks->for($workspace, viewer: $user)
            ->load('assignees:id,name')
            ->groupBy('status_id');

        $columns = $workspace->statuses()
            ->orderBy('position')
            ->get()
            ->map(fn (TaskStatus $status): array => [
                'id' => $status->id,
                'name' => $status->name,
                'kategori' => $status->category->value,
                'color' => $status->color,
                'posisi' => $status->position,
                'tasks' => $tasks->get($status->id, collect())
                    ->map(fn (Task $task): array => WorkspaceCard::make($task, $canMove))
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();

        return response()->json([
            'workspace' => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'type' => $workspace->type->value,
                'color' => $workspace->color ?? 'gray',
                'arsip' => $workspace->isArchived(),
            ],
            'columns' => $columns,
            'hidden_closed_count' => $this->boardTasks->hiddenClosedCount($workspace, $user),
            'labels' => Label::query()->where('workspace_id', $workspace->id)->orderBy('name')->get(['id', 'name', 'color'])
                ->map(fn (Label $label): array => ['id' => $label->id, 'name' => $label->name, 'color' => $label->color])
                ->values()
                ->all(),
            'members_count' => $workspace->memberships()->count(),
            'can' => [
                'edit_tasks' => $canMove,
                'move' => $canMove,
                'view_only' => $policy->isViewOnly($user, $workspace),
            ],
            'read_only' => WorkspaceAccess::readOnly($workspace, $user, $policy),
        ]);
    }
}
