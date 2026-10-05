<?php

namespace App\Domain\Projects\Queries;

use App\Domain\Analytics\Projects\ActualProgress;
use App\Domain\Analytics\Projects\PlannedProgress;
use App\Domain\Analytics\Projects\ProjectFlags;
use App\Domain\Analytics\Projects\TaskTotals;
use App\Domain\Projects\Data\ProjectMetricsData;
use App\Domain\Projects\Enums\MilestoneStatus;
use App\Domain\Projects\Enums\ProjectFlag;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Services\MilestoneStatusResolver;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Milestone;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Progress, flags and milestones of project workspaces with a constant number
 * of queries (one task aggregate + one milestone query), whatever the number
 * of projects. Formulas: app/Domain/Analytics/Projects.
 */
final class ProjectMetrics
{
    /**
     * @param  iterable<Workspace>  $workspaces
     * @return array<string, ProjectMetricsData> keyed by workspace id
     */
    public function forWorkspaces(iterable $workspaces, ?CarbonImmutable $today = null): array
    {
        $today ??= ProjectClock::today();
        $list = [];

        foreach ($workspaces as $workspace) {
            $list[$workspace->id] = $workspace;
        }

        if ($list === []) {
            return [];
        }

        $ids = array_keys($list);
        $totals = $this->taskTotals($ids, $today);
        $milestones = $this->milestones($ids, $today);
        $result = [];

        foreach ($list as $id => $workspace) {
            $result[$id] = $this->compose($workspace, $totals[$id] ?? new TaskTotals, $milestones[$id] ?? [], $today);
        }

        return $result;
    }

    public function forWorkspace(Workspace $workspace, ?CarbonImmutable $today = null): ProjectMetricsData
    {
        return $this->forWorkspaces([$workspace], $today)[$workspace->id];
    }

    /**
     * @param  list<string>  $workspaceIds
     * @return array<string, TaskTotals>
     */
    public function taskTotals(array $workspaceIds, CarbonImmutable $today): array
    {
        if ($workspaceIds === []) {
            return [];
        }

        $done = TaskStatusCategory::Done->value;
        $canceled = TaskStatusCategory::Canceled->value;

        $rows = DB::table('tasks')
            ->whereNull('deleted_at')
            ->whereIn('workspace_id', $workspaceIds)
            ->groupBy('workspace_id')
            ->selectRaw(<<<SQL
                workspace_id,
                COUNT(*) FILTER (WHERE status_category <> '{$canceled}') AS scope,
                COUNT(*) FILTER (WHERE status_category = '{$done}') AS done,
                COUNT(*) FILTER (WHERE status_category <> '{$canceled}' AND estimate_hours > 0) AS estimated,
                COALESCE(SUM(estimate_hours) FILTER (WHERE status_category <> '{$canceled}' AND estimate_hours > 0), 0) AS estimated_hours,
                COUNT(*) FILTER (WHERE status_category = '{$done}' AND estimate_hours > 0) AS done_estimated,
                COALESCE(SUM(estimate_hours) FILTER (WHERE status_category = '{$done}' AND estimate_hours > 0), 0) AS done_estimated_hours,
                COUNT(*) FILTER (WHERE due_date < ? AND status_category NOT IN ('{$done}', '{$canceled}')) AS overdue
            SQL, [$today->toDateString()])
            ->get();

        $totals = [];

        foreach ($rows as $row) {
            $values = (array) $row;
            $id = $values['workspace_id'] ?? null;

            if (! is_string($id)) {
                continue;
            }

            $totals[$id] = new TaskTotals(
                scope: (int) self::number($values['scope'] ?? 0),
                done: (int) self::number($values['done'] ?? 0),
                estimated: (int) self::number($values['estimated'] ?? 0),
                estimatedHours: self::number($values['estimated_hours'] ?? 0),
                doneEstimated: (int) self::number($values['done_estimated'] ?? 0),
                doneEstimatedHours: self::number($values['done_estimated_hours'] ?? 0),
                overdue: (int) self::number($values['overdue'] ?? 0),
            );
        }

        return $totals;
    }

    /**
     * @param  list<string>  $workspaceIds
     * @return array<string, list<array{id: string, name: string, target_date: string, status: MilestoneStatus, completed_at: string|null, started: bool}>>
     */
    private function milestones(array $workspaceIds, CarbonImmutable $today): array
    {
        $started = [TaskStatusCategory::InProgress->value, TaskStatusCategory::Review->value, TaskStatusCategory::Done->value];

        $milestones = Milestone::query()
            ->whereIn('workspace_id', $workspaceIds)
            ->withExists(['tasks as has_started_tasks' => fn (Builder $query) => $query->whereIn('status_category', $started)])
            ->orderBy('target_date')
            ->orderBy('position')
            ->get(['id', 'workspace_id', 'name', 'target_date', 'completed_at', 'position']);

        $grouped = [];

        foreach ($milestones as $milestone) {
            $hasStarted = (bool) $milestone->getAttribute('has_started_tasks');
            $grouped[$milestone->workspace_id][] = [
                'id' => $milestone->id,
                'name' => $milestone->name,
                'target_date' => $milestone->target_date->toDateString(),
                'status' => MilestoneStatusResolver::resolve($milestone->target_date, $milestone->completed_at, $hasStarted, $today),
                'completed_at' => $milestone->completed_at?->toIso8601String(),
                'started' => $hasStarted,
            ];
        }

        return $grouped;
    }

    /**
     * @param  list<array{id: string, name: string, target_date: string, status: MilestoneStatus, completed_at: string|null, started: bool}>  $milestones
     */
    private function compose(Workspace $workspace, TaskTotals $totals, array $milestones, CarbonImmutable $today): ProjectMetricsData
    {
        $actual = ActualProgress::calculate($totals);
        $planned = PlannedProgress::calculate($workspace->start_date, $workspace->target_date, $today);
        [$updateAge, $trackedDays] = self::updateAge($workspace, $today);
        $missed = count(array_filter($milestones, fn (array $milestone): bool => $milestone['status'] === MilestoneStatus::Missed));

        // System flags only make sense while the project is running.
        $flags = self::status($workspace) === ProjectStatus::Active
            ? ProjectFlags::evaluate($actual, $planned, $missed, $updateAge, $trackedDays)
            : [];

        return new ProjectMetricsData(
            workspaceId: $workspace->id,
            totals: $totals,
            actual: $actual,
            planned: $planned,
            variance: ProjectFlags::variance($actual, $planned),
            usesEstimates: ActualProgress::usesEstimates($totals),
            flags: $flags,
            milestones: $milestones,
            updateAgeDays: $updateAge,
            daysLeft: $workspace->target_date !== null ? ProjectClock::daysBetween($today, $workspace->target_date) : null,
        );
    }

    /**
     * Numeric SQL result (PostgreSQL returns bigint/numeric as int or string).
     */
    private static function number(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    /**
     * A project without a lifecycle status yet is treated as running.
     */
    /**
     * [office days since the last update (null: never), office days tracked
     * (since start_date, else creation)] — the inputs of the StaleUpdate flag.
     *
     * @return array{0: int|null, 1: int|null}
     */
    public static function updateAge(Workspace $workspace, CarbonImmutable $today): array
    {
        $updateAge = ProjectFlags::updateAgeDays($workspace->last_update_at, $today, ProjectClock::timezone());
        $trackedSince = $workspace->start_date ?? ($workspace->created_at !== null ? CarbonImmutable::parse(ProjectClock::date($workspace->created_at)) : null);

        return [$updateAge, $trackedSince !== null ? ProjectClock::daysBetween($trackedSince, $today) : null];
    }

    /**
     * The system flag "Update kedaluwarsa" (ProjectFlags), only while active.
     */
    public static function isStale(Workspace $workspace, CarbonImmutable $today): bool
    {
        if (self::status($workspace) !== ProjectStatus::Active) {
            return false;
        }

        [$updateAge, $trackedDays] = self::updateAge($workspace, $today);

        return in_array(ProjectFlag::StaleUpdate, ProjectFlags::evaluate(null, null, 0, $updateAge, $trackedDays), true);
    }

    public static function status(Workspace $workspace): ProjectStatus
    {
        return $workspace->project_status ?? ProjectStatus::Active;
    }
}
