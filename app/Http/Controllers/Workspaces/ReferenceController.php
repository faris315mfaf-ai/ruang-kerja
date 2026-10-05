<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Search\Support\LikePattern;
use App\Domain\Tasks\Services\TaskAudience;
use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Suggestions for the editor: "@" → people who can see the workspace
 * (TaskAudience), "#" → tasks the viewer can see (KEY-n or title).
 */
class ReferenceController extends Controller
{
    public function __invoke(Request $request, Workspace $workspace, #[CurrentUser] User $user, TaskAudience $audience): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $data = $request->validate([
            'type' => ['required', 'in:people,tasks'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $query = trim((string) ($data['q'] ?? ''));

        if ($data['type'] === 'people') {
            return response()->json(['people' => $audience->suggestions($workspace, $query)
                ->map(fn (User $person): array => ['id' => $person->id, 'name' => $person->name, 'avatar' => $person->avatar_url])
                ->values()->all()]);
        }

        $reference = preg_match('/^(?:([A-Za-z][A-Za-z0-9]{1,9})-)?(\d{1,9})$/', $query, $match) === 1 ? $match : null;

        $tasks = Task::query()
            ->visibleTo($user)
            ->when($query !== '', fn (Builder $scope) => $scope->where(function (Builder $match) use ($query, $reference, $workspace): void {
                $match->where('tasks.title', 'ilike', LikePattern::contains($query));

                if ($reference !== null) {
                    $key = $reference[1] !== '' ? mb_strtoupper($reference[1]) : $workspace->key;
                    $match->orWhere(fn (Builder $id) => $id
                        ->where('tasks.number', (int) $reference[2])
                        ->whereIn('tasks.workspace_id', Workspace::query()->where('key', $key)->select('id')));
                }
            }))
            // Same workspace first, then most recently updated.
            ->orderByRaw('CASE WHEN tasks.workspace_id = ? THEN 0 ELSE 1 END', [$workspace->id])
            ->orderByDesc('tasks.updated_at')
            ->with('workspace:id,key')
            ->limit(8)
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category']);

        return response()->json(['tasks' => $tasks->map(fn (Task $task): array => [
            'id' => $task->id,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'status_category' => $task->status_category->value,
        ])->values()->all()]);
    }
}
