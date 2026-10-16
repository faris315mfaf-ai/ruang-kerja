<?php

namespace App\Http\Controllers\Api\Okr;

use App\Domain\Okr\Actions\LinkTaskToKeyResult;
use App\Domain\Okr\Actions\UnlinkTaskFromKeyResult;
use App\Domain\Okr\Services\LinkableTasks;
use App\Domain\Okr\Services\OkrPresenter;
use App\Http\Controllers\Controller;
use App\Models\KeyResult;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Tasks linked to a key result in the Android app: picker search, link,
 * unlink (KeyResultPolicy::linkTask; only tasks the user sees in a workspace
 * of the objective's division — LinkableTasks, as on the web).
 */
class KeyResultTaskController extends Controller
{
    public const int SEARCH_SIZE = 20;

    /**
     * GET /okr/kr/{id}/tugas?q= — tasks not linked yet (title or "KEY-12").
     */
    public function index(Request $request, KeyResult $keyResult, #[CurrentUser] User $user, LinkableTasks $linkable, OkrPresenter $presenter): JsonResponse
    {
        Gate::authorize('linkTask', $keyResult);

        $tasks = $linkable->search($keyResult, $user, (string) $request->query('q', ''))
            ->with(['workspace:id,key', 'assignees:id,name'])
            ->orderByRaw("CASE WHEN tasks.status_category IN ('done', 'canceled') THEN 1 ELSE 0 END")
            ->orderByDesc('tasks.updated_at')
            ->limit(self::SEARCH_SIZE)
            ->get();

        return response()->json([
            'tasks' => $tasks->map(fn (Task $task): array => $presenter->task($task))->values()->all(),
        ]);
    }

    public function store(Request $request, KeyResult $keyResult, #[CurrentUser] User $user, LinkTaskToKeyResult $link, OkrPresenter $presenter): JsonResponse
    {
        Gate::authorize('linkTask', $keyResult);

        $validated = $request->validate(
            ['task_id' => ['required', 'string', 'size:26']],
            ['task_id.*' => 'Pilih tugas.'],
        );

        $task = Task::query()->find(strtolower($validated['task_id']));

        if ($task === null) {
            throw ValidationException::withMessages(['task_id' => 'Tugas tidak ditemukan.']);
        }

        $link->handle($keyResult, $task, $user);
        $task->load(['workspace:id,key', 'assignees:id,name']);

        return response()->json(['message' => "{$task->title} ditautkan.", 'task' => $presenter->task($task)], 201);
    }

    public function destroy(KeyResult $keyResult, string $task, UnlinkTaskFromKeyResult $unlink): JsonResponse
    {
        Gate::authorize('linkTask', $keyResult);

        $unlink->handle($keyResult, strtolower($task));

        return response()->json(status: 204);
    }
}
