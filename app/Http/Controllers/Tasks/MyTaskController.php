<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Queries\MyTasks;
use App\Http\Controllers\Controller;
use App\Http\Resources\TaskRowResource;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * "Tugas saya" (mockup TugasSaya / MTugasSaya): tasks across workspaces,
 * grouped by due date on the client.
 */
class MyTaskController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, MyTasks $myTasks): Response
    {
        // Rows are scoped by MyTasks (visible, non-archived workspaces only).
        Gate::authorize('viewAny', Task::class);

        $tab = in_array($request->query('tab'), MyTasks::TABS, true) ? (string) $request->query('tab') : 'assigned';
        $today = CarbonImmutable::now(config()->string('app.office_timezone'))->startOfDay();

        return Inertia::render('tasks/mine', [
            'tab' => $tab,
            'counts' => fn (): array => $myTasks->counts($user),
            'tasks' => fn (): array => $myTasks->for($user, $tab, $today->startOfWeek(CarbonImmutable::MONDAY)->utc())
                ->map(fn (Task $task): array => (new TaskRowResource($task))->resolve($request))
                ->values()
                ->all(),
            'today' => $today->toDateString(),
        ]);
    }
}
