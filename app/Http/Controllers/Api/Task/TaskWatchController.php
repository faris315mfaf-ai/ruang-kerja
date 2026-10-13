<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\ToggleTaskWatch;
use App\Http\Controllers\Controller;
use App\Http\Resources\PersonResource;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Follow / unfollow a task ("Pengamat") — the web ToggleTaskWatch behind
 * TaskPolicy::watch (everyone who can see the task, except management in
 * "lihat saja" mode). Idempotent; answers with the fresh watcher list.
 */
class TaskWatchController extends Controller
{
    public function store(Task $task, #[CurrentUser] User $user, ToggleTaskWatch $toggle): JsonResponse
    {
        Gate::authorize('watch', $task);
        $toggle->handle($task, $user, true);

        return $this->answer($task, true);
    }

    public function destroy(Task $task, #[CurrentUser] User $user, ToggleTaskWatch $toggle): JsonResponse
    {
        Gate::authorize('watch', $task);
        $toggle->handle($task, $user, false);

        return $this->answer($task, false);
    }

    private function answer(Task $task, bool $watching): JsonResponse
    {
        return response()->json([
            'watching' => $watching,
            'watchers' => $task->watchers()->select('users.id', 'users.name', 'users.avatar_url')->orderBy('users.name')->get()
                ->map(fn (User $watcher): array => PersonResource::from($watcher))
                ->values()
                ->all(),
        ]);
    }
}
