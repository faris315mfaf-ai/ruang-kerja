<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Tasks\Queries\BoardTasks;
use App\Http\Controllers\Controller;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
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
 */
class WorkspaceBoardController extends Controller
{
    public function __construct(private readonly BoardTasks $boardTasks) {}

    public function __invoke(Workspace $workspace, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $workspace);

        /** @var Collection<string, Collection<int, Task>> $tasks */
        $tasks = $this->boardTasks->for($workspace, viewer: $user)->groupBy('status_id');

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
                    ->map(fn (Task $task): array => (new TaskResource($task))->resolve())
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();

        // The app card shows assignee names; TaskResource only carries ids.
        $names = User::query()
            ->whereIn('id', collect($columns)
                ->flatMap(fn (array $column): array => array_column($column['tasks'], 'assignee_ids'))
                ->flatten()
                ->filter()
                ->unique()
                ->values()
                ->all())
            ->pluck('name', 'id');

        foreach ($columns as &$column) {
            foreach ($column['tasks'] as &$card) {
                $card['assignees'] = array_map(
                    fn ($id): array => ['id' => $id, 'nama' => $names[$id] ?? null],
                    $card['assignee_ids'] ?? [],
                );
            }
        }
        unset($column, $card);

        return response()->json([
            'workspace' => ['id' => $workspace->id, 'key' => $workspace->key, 'name' => $workspace->name],
            'columns' => $columns,
            'hidden_closed_count' => $this->boardTasks->hiddenClosedCount($workspace),
        ]);
    }
}
