<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Actions\ToggleTaskWatch;
use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Follow / unfollow a task ("Pengamat").
 */
class TaskWatchController extends Controller
{
    public function store(Task $task, #[CurrentUser] User $user, ToggleTaskWatch $toggle): JsonResponse
    {
        Gate::authorize('watch', $task);
        $toggle->handle($task, $user, true);

        return response()->json(['watching' => true]);
    }

    public function destroy(Task $task, #[CurrentUser] User $user, ToggleTaskWatch $toggle): JsonResponse
    {
        Gate::authorize('watch', $task);
        $toggle->handle($task, $user, false);

        return response()->json(['watching' => false]);
    }
}
