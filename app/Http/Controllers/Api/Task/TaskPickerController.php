<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Search\Support\LikePattern;
use App\Domain\Tasks\Services\TaskAudience;
use App\Http\Controllers\Controller;
use App\Http\Resources\PersonResource;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Pickers of the comment composer: "@" lists the people who can see a task
 * (TaskAudience — members, plus every employee for an internal workspace;
 * the final mention check still runs per person when the comment is saved),
 * "#" lists the tasks the viewer may see by KEY-n or title.
 */
class TaskPickerController extends Controller
{
    public function mention(Request $request, Task $task, TaskAudience $audience): JsonResponse
    {
        Gate::authorize('view', $task);

        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'limit' => ['sometimes', 'integer', 'between:1,20'],
        ]);

        $task->loadMissing('workspace');

        return response()->json(['people' => $audience->suggestions($task->workspace, trim((string) ($data['q'] ?? '')), (int) ($data['limit'] ?? 8))
            ->map(fn (User $person): array => PersonResource::from($person))
            ->values()
            ->all()]);
    }

    public function reference(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', Task::class);

        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'workspace' => ['sometimes', 'nullable', 'string', 'max:26'],
            'limit' => ['sometimes', 'integer', 'between:1,20'],
        ]);
        $query = trim((string) ($data['q'] ?? ''));

        // The workspace the user is writing in sorts first; unknown or unseen → ignored.
        $workspace = null;

        if (filled($data['workspace'] ?? null)) {
            $value = (string) $data['workspace'];
            $workspace = Workspace::query()->visibleTo($user)
                ->where(fn (Builder $match): Builder => $match->where('key', mb_strtoupper($value))->orWhere('id', mb_strtolower($value)))
                ->first();
        }

        $reference = preg_match('/^(?:([A-Za-z][A-Za-z0-9]{1,9})-)?(\d{1,9})$/', $query, $match) === 1 ? $match : null;

        $tasks = Task::query()
            ->visibleTo($user)
            ->when($query !== '', fn (Builder $scope) => $scope->where(function (Builder $search) use ($query, $reference, $workspace): void {
                $search->where('tasks.title', 'ilike', LikePattern::contains($query));

                if ($reference !== null) {
                    $key = $reference[1] !== '' ? mb_strtoupper($reference[1]) : $workspace?->key;

                    if ($key !== null) {
                        $search->orWhere(fn (Builder $id) => $id
                            ->where('tasks.number', (int) $reference[2])
                            ->whereIn('tasks.workspace_id', Workspace::query()->where('key', $key)->select('id')));
                    }
                }
            }))
            ->when($workspace !== null, fn (Builder $scope) => $scope->orderByRaw('CASE WHEN tasks.workspace_id = ? THEN 0 ELSE 1 END', [$workspace?->id]))
            ->orderByDesc('tasks.updated_at')
            ->orderBy('tasks.id')
            ->with('workspace:id,key,name')
            ->limit((int) ($data['limit'] ?? 8))
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category']);

        return response()->json(['tasks' => $tasks->map(fn (Task $task): array => [
            'id' => $task->id,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'status_category' => $task->status_category->value,
            'workspace' => ['key' => $task->workspace->key, 'name' => $task->workspace->name],
        ])->values()->all()]);
    }
}
