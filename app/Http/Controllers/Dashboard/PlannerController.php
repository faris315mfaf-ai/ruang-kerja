<?php

namespace App\Http\Controllers\Dashboard;

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Planner\Actions\CompletePlannedTask;
use App\Domain\Planner\Actions\PlanTask;
use App\Domain\Planner\Actions\QuickAddPersonalTask;
use App\Domain\Planner\Actions\UnplanTask;
use App\Domain\Planner\Queries\PersonalPlanner;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Http\Controllers\Controller;
use App\Http\Requests\Planner\PlanTaskRequest;
use App\Http\Requests\Planner\QuickAddRequest;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Ruang saya" on Beranda (JSON for the optimistic client): every change
 * answers with the fresh planner so the client never drifts. Plans are the
 * signed-in user's own; the task must be assigned to them or live in their
 * personal workspace (TaskPolicy::plan).
 */
class PlannerController extends Controller
{
    public function __construct(private readonly PersonalPlanner $planner) {}

    public function show(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewDashboard', DashboardView::Personal);

        return $this->snapshot($user);
    }

    public function plan(PlanTaskRequest $request, Task $task, #[CurrentUser] User $user, PlanTask $planTask): JsonResponse
    {
        Gate::authorize('plan', $task);

        $planTask->handle(
            $user,
            $task,
            $request->bucket(),
            $request->filled('after_id') ? $request->string('after_id')->toString() : null,
            $request->filled('before_id') ? $request->string('before_id')->toString() : null,
        );

        return $this->snapshot($user);
    }

    public function unplan(Task $task, #[CurrentUser] User $user, UnplanTask $unplanTask): JsonResponse
    {
        $this->hideInvisible($user, $task);
        Gate::authorize('plan', $task);

        $unplanTask->handle($user, $task);

        return $this->snapshot($user);
    }

    public function complete(Task $task, #[CurrentUser] User $user, CompletePlannedTask $complete): JsonResponse
    {
        $this->hideInvisible($user, $task);
        Gate::authorize('plan', $task);
        Gate::authorize('move', $task);

        $result = $complete->handle($user, $task);
        $moved = $result['task'];

        return $this->snapshot($user, [
            'outcome' => $result['outcome'],
            'previous_status_id' => $result['previous_status_id'],
            'status' => ['id' => $moved->status->id, 'name' => $moved->status->name],
        ]);
    }

    public function store(
        QuickAddRequest $request,
        #[CurrentUser] User $user,
        EnsurePersonalWorkspace $ensurePersonal,
        QuickAddPersonalTask $quickAdd,
    ): JsonResponse {
        $personal = $ensurePersonal->handle($user);
        Gate::authorize('editTasks', $personal);

        $task = $quickAdd->handle($personal, $user, $request->string('title')->toString(), $request->bucket());

        return $this->snapshot($user, ['task' => ['id' => $task->id, 'key' => $personal->key.'-'.$task->number]], 201);
    }

    /**
     * Same 404-before-anything rule as the FormRequests (HidesInvisibleWorkspaces).
     */
    private function hideInvisible(User $user, Task $task): void
    {
        abort_unless(Gate::forUser($user)->allows('view', $task), 404);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function snapshot(User $user, array $extra = [], int $status = 200): JsonResponse
    {
        return response()->json([...$extra, 'planner' => $this->planner->for($user, CarbonImmutable::now())], $status);
    }
}
