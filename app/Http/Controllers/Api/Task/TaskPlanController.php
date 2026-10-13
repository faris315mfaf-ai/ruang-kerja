<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Planner\Actions\PlanTask;
use App\Domain\Planner\Actions\UnplanTask;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Planner\Queries\PersonalPlanner;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskPlanRequest;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Rencana saya" for the mobile app (private per user, TaskPlanPolicy): the
 * three lanes Hari ini · Minggu ini · Nanti with the "tugas baru" inbox and the
 * "terbawa dari kemarin" marks (PersonalPlanner), and planning a single task
 * (PlanTask / UnplanTask behind TaskPolicy::plan — only tasks assigned to the
 * caller or living in their own personal workspace).
 */
class TaskPlanController extends Controller
{
    public function __construct(private readonly PersonalPlanner $planner) {}

    public function index(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewDashboard', DashboardView::Personal);

        return response()->json($this->snapshot($user));
    }

    public function update(TaskPlanRequest $request, Task $task, #[CurrentUser] User $user, PlanTask $planTask, UnplanTask $unplanTask): JsonResponse
    {
        Gate::authorize('plan', $task);

        $bucket = $request->bucket();
        $plan = $bucket === null
            ? $unplanTask->handle($user, $task)
            : $this->plan($request, $planTask, $user, $task, $bucket);

        return response()->json([
            'plan' => [
                'task_id' => $task->id,
                'bucket' => $plan->bucket?->value,
                'planned_for' => $plan->planned_for?->toDateString(),
                'seen_at' => $plan->seen_at?->toIso8601String(),
            ],
            'planner' => $this->snapshot($user),
        ]);
    }

    private function plan(TaskPlanRequest $request, PlanTask $planTask, User $user, Task $task, PlanBucket $bucket): TaskPlan
    {
        $after = $request->filled('after_id') ? strtolower($request->string('after_id')->toString()) : null;
        $before = $request->filled('before_id') ? strtolower($request->string('before_id')->toString()) : null;

        // `position` = index among the lane's planned tasks (same order PlanTask uses).
        if ($after === null && $before === null && $request->filled('position')) {
            $lane = TaskPlan::query()
                ->ownedBy($user)
                ->where('bucket', $bucket->value)
                ->where('task_id', '!=', $task->id)
                ->orderBy('position')
                ->orderBy('id')
                ->pluck('task_id')
                ->all();
            $index = $request->integer('position');
            $after = $index > 0 ? ($lane[min($index, count($lane)) - 1] ?? null) : null;
            $before = $after === null ? ($lane[0] ?? null) : null;
        }

        return $planTask->handle($user, $task, $bucket, $after, $before);
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(User $user): array
    {
        return [
            ...$this->planner->for($user, CarbonImmutable::now()),
            'lane_labels' => array_combine(
                PlanBucket::values(),
                array_map(fn (PlanBucket $bucket): string => $bucket->label(), PlanBucket::cases()),
            ),
        ];
    }
}
