<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Queries\BoardTasks;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\WorkspaceAccess;
use App\Http\Resources\Api\WorkspaceCard;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/workspace/{workspace}/kalender?bulan=YYYY-MM — the Calendar
 * view of a workspace (mockup 18, week strip + month grid + "Tanpa tenggat").
 *
 * `tasks` = every task due inside the month grid (Monday-first weeks, so the
 * leading/trailing days of the neighbouring months are filled, like the web
 * grid), closed ones included; `tanpa_tenggat` = open tasks without a due
 * date (newest first, max 100); `terlambat` = how many open tasks are
 * overdue today (any month). Dates are office-timezone calendar dates.
 */
class WorkspaceCalendarController extends Controller
{
    public const int NO_DUE_LIMIT = 100;

    public function __invoke(Request $request, Workspace $workspace, #[CurrentUser] User $user, WorkspacePolicy $policy): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $request->validate(['bulan' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/']], [
            'bulan.regex' => 'Bulan harus berformat YYYY-MM, mis. 2026-10.',
        ]);

        $tz = CurrentCompany::timezone();
        $today = CarbonImmutable::now($tz)->startOfDay();
        $month = $request->filled('bulan')
            ? CarbonImmutable::createFromFormat('!Y-m', $request->string('bulan')->toString(), $tz)
            : $today->startOfMonth();
        $month = $month instanceof CarbonImmutable ? $month : $today->startOfMonth();

        $from = $month->startOfWeek(CarbonImmutable::MONDAY);
        $to = $month->endOfMonth()->endOfWeek(CarbonImmutable::SUNDAY);
        $canMove = $policy->canEditTasks($user, $workspace);
        $closed = TaskStatusCategory::closedValues();

        $dated = BoardTasks::query($user)
            ->with(['assignees:id,name', 'status:id,name,category,color'])
            ->where('tasks.workspace_id', $workspace->id)
            ->whereBetween('tasks.due_date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('tasks.due_date')
            ->orderByRaw('case when tasks.priority = 0 then 5 else tasks.priority end')
            ->orderBy('tasks.number')
            ->limit(1000)
            ->get();

        $undated = BoardTasks::query($user)
            ->with(['assignees:id,name', 'status:id,name,category,color'])
            ->where('tasks.workspace_id', $workspace->id)
            ->whereNull('tasks.due_date')
            ->whereNotIn('tasks.status_category', $closed)
            ->orderByDesc('tasks.created_at')
            ->orderByDesc('tasks.id')
            ->limit(self::NO_DUE_LIMIT)
            ->get();

        $overdue = Task::query()
            ->where('workspace_id', $workspace->id)
            ->respectingPrivacyOf($user)
            ->whereNotIn('status_category', $closed)
            ->whereDate('due_date', '<', $today->toDateString())
            ->count();

        return response()->json([
            'workspace' => ['id' => $workspace->id, 'key' => $workspace->key, 'name' => $workspace->name],
            'bulan' => $month->format('Y-m'),
            'today' => $today->toDateString(),
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'tasks' => $dated->map(fn (Task $task): array => WorkspaceCard::make($task, $canMove)
                + ['overdue' => $task->due_date !== null && $task->due_date->toDateString() < $today->toDateString() && ! $task->status_category->isClosed()])
                ->values()->all(),
            'tanpa_tenggat' => $undated->map(fn (Task $task): array => WorkspaceCard::make($task, $canMove))->values()->all(),
            'terlambat' => $overdue,
            'can' => ['move' => $canMove],
            'read_only' => WorkspaceAccess::readOnly($workspace, $user, $policy),
        ]);
    }
}
