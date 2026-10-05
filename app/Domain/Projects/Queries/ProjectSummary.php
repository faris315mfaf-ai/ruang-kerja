<?php

namespace App\Domain\Projects\Queries;

use App\Domain\Analytics\Projects\TaskTotals;
use App\Domain\Projects\Enums\MilestoneStatus;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\RiskLevel;
use App\Domain\Projects\Enums\RiskStatus;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Projects\Services\ProjectPresenter;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Milestone;
use App\Models\ProjectDirection;
use App\Models\ProjectProgressSnapshot;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Tab "Ringkasan" of a project workspace (mockups ProyekDetail /
 * MProyekDetail): KPIs, burn-up, milestones, updates, risks, overdue tasks,
 * team load and Direksi directions.
 */
final class ProjectSummary
{
    public const int HISTORY_SIZE = 12;

    public const int DIRECTIONS_SIZE = 10;

    public function __construct(
        private readonly ProjectMetrics $metrics,
        private readonly WorkspacePolicy $policy,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(Workspace $workspace, User $viewer, ?CarbonImmutable $today = null): array
    {
        $today ??= ProjectClock::today();
        $workspace->loadMissing(['lead:id,name,avatar_url', 'sponsor:id,name,avatar_url', 'division:id,name']);
        $metrics = $this->metrics->forWorkspace($workspace, $today);
        $canManage = $this->policy->canManageProject($viewer, $workspace);

        return [
            'project' => [
                ...ProjectPresenter::project($workspace, $metrics),
                'member_divisions' => $this->memberDivisions($workspace),
            ],
            'status_counts' => $this->statusCounts($workspace),
            'milestones' => $this->milestones($workspace, $metrics->milestones),
            'burnup' => $this->burnup($workspace, $metrics->totals, $metrics->milestones, $today),
            'updates' => $this->updates($workspace),
            'risks' => $this->risks($workspace),
            'overdue_tasks' => $this->overdueTasks($workspace, $today),
            'team_load' => $this->teamLoad($workspace),
            'directions' => $this->directions($workspace),
            'task_options' => $canManage ? $this->taskOptions($workspace) : [],
            'project_can' => [
                'manage' => $canManage,
                'steer' => $this->policy->steerProject($viewer, $workspace)->allowed(),
            ],
            'health_options' => array_map(fn (ProjectHealth $health): array => ['value' => $health->value, 'label' => $health->label()], ProjectHealth::cases()),
            'risk_level_options' => array_map(fn (RiskLevel $level): array => ['value' => $level->value, 'label' => $level->label()], RiskLevel::cases()),
            'today' => $today->toDateString(),
        ];
    }

    /**
     * Division names of the members ("Pemasaran, Operasional, Keuangan").
     *
     * @return list<string>
     */
    private function memberDivisions(Workspace $workspace): array
    {
        return array_values(array_map('strval', DB::table('workspace_members')
            ->join('users', 'users.id', '=', 'workspace_members.user_id')
            ->join('divisions', 'divisions.id', '=', 'users.division_id')
            ->where('workspace_members.workspace_id', $workspace->id)
            ->groupBy('divisions.name')
            ->orderByRaw('COUNT(*) DESC, divisions.name')
            ->pluck('divisions.name')
            ->all()));
    }

    /**
     * @return array<string, int>
     */
    private function statusCounts(Workspace $workspace): array
    {
        $counts = array_fill_keys(array_map(fn (TaskStatusCategory $category): string => $category->value, TaskStatusCategory::cases()), 0);

        $rows = Task::query()
            ->where('workspace_id', $workspace->id)
            ->toBase()
            ->groupBy('status_category')
            ->selectRaw('status_category, COUNT(*) AS total')
            ->get();

        foreach ($rows as $row) {
            $values = (array) $row;
            $category = $values['status_category'] ?? null;

            if (is_string($category) && array_key_exists($category, $counts)) {
                $counts[$category] = is_numeric($values['total'] ?? null) ? (int) $values['total'] : 0;
            }
        }

        return $counts;
    }

    /**
     * @param  list<array{id: string, name: string, target_date: string, status: MilestoneStatus, completed_at: string|null, started: bool}>  $computed
     * @return list<array<string, mixed>>
     */
    private function milestones(Workspace $workspace, array $computed): array
    {
        $statuses = [];

        foreach ($computed as $milestone) {
            $statuses[$milestone['id']] = $milestone['status']->value;
        }

        return array_values(Milestone::query()
            ->where('workspace_id', $workspace->id)
            ->with(['tasks' => fn ($query) => $query->orderBy('number')->select(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category', 'tasks.status_id']), 'tasks.status:id,color'])
            ->orderBy('target_date')
            ->orderBy('position')
            ->get()
            ->map(fn (Milestone $milestone): array => [
                'id' => $milestone->id,
                'name' => $milestone->name,
                'description' => $milestone->description,
                'target_date' => $milestone->target_date->toDateString(),
                'completed_at' => $milestone->completed_at?->toIso8601String(),
                'status' => $statuses[$milestone->id] ?? 'not_started',
                'tasks' => $milestone->tasks->map(fn (Task $task): array => $this->taskRef($workspace, $task))->values()->all(),
            ])
            ->all());
    }

    /**
     * Weekly burn-up points from kickoff to today (value = latest snapshot on
     * or before the date; today = live totals), plus the ideal line inputs.
     *
     * @param  list<array{id: string, name: string, target_date: string, status: MilestoneStatus, completed_at: string|null, started: bool}>  $milestones
     * @return array<string, mixed>
     */
    private function burnup(Workspace $workspace, TaskTotals $totals, array $milestones, CarbonImmutable $today): array
    {
        $start = $workspace->start_date !== null ? CarbonImmutable::parse($workspace->start_date->toDateString()) : null;
        $points = [];

        if ($start !== null && $start->lte($today)) {
            $snapshots = ProjectProgressSnapshot::query()
                ->where('workspace_id', $workspace->id)
                ->where('date', '<=', $today->toDateString())
                ->orderBy('date')
                ->get(['date', 'scope_count', 'done_count']);

            $snapshots = array_values($snapshots->all());
            $index = 0;
            $latest = null;
            $count = count($snapshots);

            for ($date = $start; $date->lt($today); $date = $date->addWeek()) {
                while ($index < $count && $snapshots[$index]->date->toDateString() <= $date->toDateString()) {
                    $latest = $snapshots[$index];
                    $index++;
                }

                $points[] = [
                    'date' => $date->toDateString(),
                    'scope' => $latest?->scope_count,
                    'done' => $latest?->done_count,
                ];
            }

            $points[] = ['date' => $today->toDateString(), 'scope' => $totals->scope, 'done' => $totals->done];
        }

        // Four-week pace (done tasks per week) and the pace needed to finish on target.
        $fourWeeksAgo = null;

        foreach ($points as $point) {
            if ($point['date'] <= $today->subWeeks(4)->toDateString() && $point['done'] !== null) {
                $fourWeeksAgo = $point['done'];
            }
        }

        $weeksLeft = $workspace->target_date !== null ? max(0, ProjectClock::daysBetween($today, $workspace->target_date)) / 7 : null;
        $remaining = $totals->scope - $totals->done;

        return [
            'start_date' => $start?->toDateString(),
            'target_date' => $workspace->target_date?->toDateString(),
            'today' => $today->toDateString(),
            'points' => $points,
            'initial_scope' => $points[0]['scope'] ?? null,
            'recent_pace' => $fourWeeksAgo !== null ? round(($totals->done - $fourWeeksAgo) / 4, 1) : null,
            'required_pace' => $weeksLeft !== null && $weeksLeft > 0 ? round($remaining / $weeksLeft, 1) : null,
            'milestones' => array_map(fn (array $milestone): array => [
                'id' => $milestone['id'],
                'name' => $milestone['name'],
                'target_date' => $milestone['target_date'],
                'status' => $milestone['status']->value,
            ], $milestones),
        ];
    }

    /**
     * Latest updates first; each with its Direksi replies.
     *
     * @return list<array<string, mixed>>
     */
    private function updates(Workspace $workspace): array
    {
        return array_values(ProjectUpdate::query()
            ->where('workspace_id', $workspace->id)
            ->with(['author:id,name,avatar_url', 'resolver:id,name', 'directions' => fn ($query) => $query->oldest('created_at'), 'directions.author:id,name,avatar_url'])
            ->latest('created_at')
            ->latest('id')
            ->limit(self::HISTORY_SIZE)
            ->get()
            ->map(fn (ProjectUpdate $update): array => [
                'id' => $update->id,
                'health' => $update->health->value,
                'summary' => $update->summary,
                'blockers' => $update->blockers,
                'decision_needed' => $update->decision_needed,
                'decision_resolved_at' => $update->decision_resolved_at?->toIso8601String(),
                'decision_resolved_by' => $update->resolver?->name,
                'progress_snapshot' => $update->progress_snapshot !== null ? (float) $update->progress_snapshot : null,
                'planned_snapshot' => $update->planned_snapshot !== null ? (float) $update->planned_snapshot : null,
                'author' => ProjectPresenter::person($update->author),
                'created_at' => $update->created_at->toIso8601String(),
                'directions' => $update->directions->map(fn (ProjectDirection $direction): array => $this->direction($direction))->values()->all(),
            ])
            ->all());
    }

    /**
     * Open risks first (high → low), then resolved ones.
     *
     * @return list<array<string, mixed>>
     */
    private function risks(Workspace $workspace): array
    {
        return array_values(ProjectRisk::query()
            ->where('workspace_id', $workspace->id)
            ->with(['owner:id,name,avatar_url', 'task:id,workspace_id,number,title,status_category'])
            ->get()
            ->sortBy(fn (ProjectRisk $risk): string => ($risk->status === RiskStatus::Open ? '0' : '1').$risk->level->rank().$risk->created_at?->toIso8601String())
            ->map(fn (ProjectRisk $risk): array => [
                'id' => $risk->id,
                'title' => $risk->title,
                'level' => $risk->level->value,
                'status' => $risk->status->value,
                'resolved_at' => $risk->resolved_at?->toIso8601String(),
                'owner' => ProjectPresenter::person($risk->owner),
                'task' => $risk->task !== null ? $this->taskRef($workspace, $risk->task) : null,
            ])
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function overdueTasks(Workspace $workspace, CarbonImmutable $today): array
    {
        return array_values(Task::query()
            ->where('workspace_id', $workspace->id)
            ->whereNotIn('status_category', TaskStatusCategory::closedValues())
            ->where('due_date', '<', $today->toDateString())
            ->with(['assignees:id,name,avatar_url', 'status:id,color'])
            ->orderBy('due_date')
            ->orderBy('number')
            ->limit(20)
            ->get()
            ->map(fn (Task $task): array => [
                ...$this->taskRef($workspace, $task),
                'due_date' => $task->due_date?->toDateString(),
                'assignee' => ProjectPresenter::person($task->assignees->first()),
            ])
            ->all());
    }

    /**
     * Open tasks per member ("Tim & beban"), busiest first.
     *
     * @return array{members: list<array{person: array{id: string, name: string, avatar: string|null}|null, open: int}>, idle: int, open_total: int}
     */
    private function teamLoad(Workspace $workspace): array
    {
        $counts = DB::table('task_assignees')
            ->join('tasks', 'tasks.id', '=', 'task_assignees.task_id')
            ->where('tasks.workspace_id', $workspace->id)
            ->whereNull('tasks.deleted_at')
            ->whereNotIn('tasks.status_category', TaskStatusCategory::closedValues())
            ->groupBy('task_assignees.user_id')
            ->pluck(DB::raw('COUNT(*)'), 'task_assignees.user_id')
            ->all();

        $members = User::query()
            ->whereIn('id', $workspace->memberships()->select('user_id'))
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_url']);

        $rows = [];
        $idle = 0;

        foreach ($members as $member) {
            $open = is_numeric($counts[$member->id] ?? null) ? (int) $counts[$member->id] : 0;

            if ($open === 0) {
                $idle++;

                continue;
            }

            $rows[] = ['person' => ProjectPresenter::person($member), 'open' => $open];
        }

        usort($rows, fn (array $a, array $b): int => $b['open'] <=> $a['open']);

        $openTotal = Task::query()
            ->where('workspace_id', $workspace->id)
            ->whereNotIn('status_category', TaskStatusCategory::closedValues())
            ->count();

        return ['members' => $rows, 'idle' => $idle, 'open_total' => $openTotal];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function directions(Workspace $workspace): array
    {
        return array_values(ProjectDirection::query()
            ->where('workspace_id', $workspace->id)
            ->with('author:id,name,avatar_url')
            ->latest('created_at')
            ->latest('id')
            ->limit(self::DIRECTIONS_SIZE)
            ->get()
            ->map(fn (ProjectDirection $direction): array => $this->direction($direction))
            ->all());
    }

    /**
     * Tasks a milestone or risk can be linked to.
     *
     * @return list<array<string, mixed>>
     */
    private function taskOptions(Workspace $workspace): array
    {
        return array_values(Task::query()
            ->where('workspace_id', $workspace->id)
            ->where('status_category', '!=', TaskStatusCategory::Canceled->value)
            ->orderBy('number')
            ->limit(500)
            ->get(['id', 'workspace_id', 'number', 'title', 'status_category'])
            ->map(fn (Task $task): array => $this->taskRef($workspace, $task))
            ->all());
    }

    /**
     * @return array{id: string, body: string, author: array{id: string, name: string, avatar: string|null}|null, project_update_id: string|null, created_at: string}
     */
    private function direction(ProjectDirection $direction): array
    {
        return [
            'id' => $direction->id,
            'body' => $direction->body,
            'author' => ProjectPresenter::person($direction->author),
            'project_update_id' => $direction->project_update_id,
            'created_at' => $direction->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array{id: string, code: string, title: string, status_category: string, status_color: string|null}
     */
    private function taskRef(Workspace $workspace, Task $task): array
    {
        return [
            'id' => $task->id,
            'code' => "{$workspace->key}-{$task->number}",
            'title' => $task->title,
            'status_category' => $task->status_category->value,
            'status_color' => $task->relationLoaded('status') ? $task->status->color : null,
        ];
    }
}
