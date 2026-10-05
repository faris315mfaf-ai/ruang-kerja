<?php

namespace App\Domain\Analytics\Queries;

use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\MetricDefinitions\AttendanceDiscipline;
use App\Domain\Analytics\MetricDefinitions\AverageLateness;
use App\Domain\Analytics\MetricDefinitions\CompletionRate;
use App\Domain\Analytics\MetricDefinitions\LeadTimeMedian;
use App\Domain\Analytics\MetricDefinitions\OnTimeRate;
use App\Domain\Analytics\MetricDefinitions\OverdueTasks;
use App\Domain\Analytics\MetricDefinitions\Workload;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Analytics\Services\TodayAttendance;
use App\Domain\Analytics\Support\ProjectHealth;
use App\Domain\Analytics\Support\TaskSummary;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Http\Presenters\RequestPresenter;
use App\Models\RequestApproval;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * "Dashboard Kepala Divisi" (PRD M7, mockups Main / MDashboardKadiv): who is
 * in today, workload per member, overdue tasks, the 8-week completion trend,
 * the approval queue and project workspaces at risk — for the people of the
 * divisions in the viewer's scope (DashboardAccess::people()).
 */
final class DivisionDashboard
{
    public function __construct(
        private readonly MetricCache $cache,
        private readonly TodayAttendance $attendance,
        private readonly ApprovalQueue $approvals,
        private readonly RequestPresenter $requests,
    ) {}

    /**
     * @param  Collection<int, User>  $people
     * @return array<string, mixed>
     */
    public function metrics(User $viewer, Collection $people, DashboardFilters $filters, CarbonImmutable $now): array
    {
        $scope = new MetricScope($viewer, array_values($people->modelKeys()));
        $today = Period::officeDate($now);

        return $this->cache->remember(
            DashboardView::Division,
            $viewer,
            'metrics',
            [...$filters->cacheParts(), 'today' => $today->toDateString(), 'scope' => $scope->fingerprint()],
            fn (): array => $this->compute($scope, $people, $filters->period, $today, $now),
        );
    }

    /**
     * Live: today's attendance of the people (not cached, updated by broadcast).
     *
     * @param  Collection<int, User>  $people
     * @return array<string, mixed>
     */
    public function today(Collection $people, CarbonImmutable $now): array
    {
        return $this->attendance->for($people, $now);
    }

    /**
     * Live: "Menunggu persetujuan Anda" of the viewer.
     *
     * @return array{count: int, items: array<int, array<string, mixed>>}
     */
    public function approvals(User $viewer): array
    {
        $steps = $this->approvals->waitingFor($viewer)
            ->with(['request.leaveType', 'request.user.position', 'request.user.division', 'request.approvals.approver'])
            ->oldest('activated_at')
            ->limit(3)
            ->get();

        return [
            'count' => $this->approvals->count($viewer),
            'items' => $steps->map(fn (RequestApproval $step): array => $this->requests->item($step->request))->values()->all(),
        ];
    }

    /**
     * @param  Collection<int, User>  $people
     * @return array<string, mixed>
     */
    private function compute(MetricScope $scope, Collection $people, Period $period, CarbonImmutable $today, CarbonImmutable $now): array
    {
        [$current, $previous] = $period->comparable($now);
        $completion = new CompletionRate;
        $onTime = new OnTimeRate;
        $leadTime = new LeadTimeMedian;
        $discipline = new AttendanceDiscipline;
        $lateness = new AverageLateness;
        $workload = (new Workload)->compute($scope, $today);
        $weeks = array_map(fn (Period $week): Period => $week->toDate($now), Period::weeksEndingAt($now));
        $trend = $completion->series($scope, $weeks);
        $overdueByPerson = array_filter(array_column($workload, 'overdue'));

        return [
            'period' => $period->toArray(),
            'compared' => ['current' => $current->toArray(), 'previous' => $previous->toArray()],
            'kpis' => [
                'completion_rate' => $completion->compute($scope, $current)->compareTo($completion->compute($scope, $previous)),
                'on_time_rate' => $onTime->compute($scope, $current)->compareTo($onTime->compute($scope, $previous)),
                'overdue_tasks' => [
                    'value' => (int) (new OverdueTasks)->compute($scope, $today)->value,
                    'people' => count($overdueByPerson),
                    'top_person' => $overdueByPerson === [] ? 0 : max($overdueByPerson),
                ],
                'lead_time' => $leadTime->compute($scope, $current)->compareTo($leadTime->compute($scope, $previous), 1),
                'attendance_discipline' => $discipline->compute($scope, $current)->compareTo($discipline->compute($scope, $previous)),
                'average_lateness' => $lateness->compute($scope, $current)->compareTo($lateness->compute($scope, $previous)),
            ],
            'trend' => array_map(fn (Period $week, int $index): array => [
                'week_start' => $week->startDate(),
                'label' => $week->shortLabel(),
                ...$trend[$index]->toArray(),
            ], $weeks, array_keys($weeks)),
            'workload' => $this->workloadRows($people, $workload),
            'overdue' => $this->overdueList($scope, $today),
            'projects' => $this->projectsAtRisk($scope, $now),
        ];
    }

    /**
     * @param  Collection<int, User>  $people
     * @param  array<string, array{open: int, overdue: int, estimate_hours: float|null}>  $workload
     * @return list<array<string, mixed>>
     */
    private function workloadRows(Collection $people, array $workload): array
    {
        $rows = $people->map(fn (User $user): array => [
            'user' => ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url],
            ...$workload[$user->id] ?? ['open' => 0, 'overdue' => 0, 'estimate_hours' => null],
        ])->all();

        usort($rows, fn (array $a, array $b): int => [$b['open'], $b['overdue'], $a['user']['name']] <=> [$a['open'], $a['overdue'], $b['user']['name']]);

        return $rows;
    }

    /**
     * @return array{total: int, items: array<int, array<string, mixed>>}
     */
    private function overdueList(MetricScope $scope, CarbonImmutable $today): array
    {
        $query = (new OverdueTasks)->query($scope, $today);

        return [
            'total' => (clone $query)->count(),
            'items' => $query
                ->with(['workspace:id,key,name', 'assignees' => fn ($assignees) => $assignees->select('users.id', 'users.name', 'users.avatar_url')->whereIn('users.id', $scope->userIds)])
                ->orderBy('tasks.due_date')
                ->orderBy('tasks.priority')
                ->limit(8)
                ->get()
                ->map(fn (Task $task): array => TaskSummary::from($task, $today))
                ->values()
                ->all(),
        ];
    }

    /**
     * Project workspaces involving the people that need attention: PIC
     * health "Berisiko"/"Bermasalah", or an active project without an update
     * for more than 7 days (PRD M10 "Update kedaluwarsa").
     *
     * @return array<int, array<string, mixed>>
     */
    private function projectsAtRisk(MetricScope $scope, CarbonImmutable $now): array
    {
        $staleBefore = $now->subDays(config()->integer('analytics.stale_update_days'));

        $projects = Workspace::query()
            ->visibleTo($scope->viewer)
            ->notArchived()
            ->where('workspaces.type', WorkspaceType::Project->value)
            ->where(fn (Builder $query) => $query->whereNull('workspaces.project_status')->orWhereIn('workspaces.project_status', ['planned', 'active', 'on_hold']))
            ->whereExists(fn (QueryBuilder $member) => $member->selectRaw('1')
                ->from('workspace_members')
                ->whereColumn('workspace_members.workspace_id', 'workspaces.id')
                ->whereIn('workspace_members.user_id', $scope->userIds))
            ->where(fn (Builder $query) => $query
                ->whereIn('workspaces.health', ProjectHealth::AT_RISK)
                ->orWhere(fn (Builder $stale) => $stale
                    ->where('workspaces.project_status', 'active')
                    ->where(fn (Builder $update) => $update->whereNull('workspaces.last_update_at')->orWhere('workspaces.last_update_at', '<', $staleBefore->toIso8601String()))))
            ->orderByRaw("case workspaces.health when 'off_track' then 0 when 'at_risk' then 1 else 2 end")
            ->orderBy('workspaces.name')
            ->limit(6)
            ->get();

        // PIC names without touching the Workspace model (the project module owns its relations).
        $leads = User::query()->whereIn('id', $projects->pluck('lead_user_id')->filter()->unique()->values()->all())->pluck('name', 'id');

        return $projects
            ->map(fn (Workspace $workspace): array => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'url' => '/w/'.$workspace->key,
                'health' => $workspace->health,
                'health_label' => ProjectHealth::label($workspace->health),
                'last_update_at' => $workspace->last_update_at?->toIso8601String(),
                'stale' => $workspace->project_status === 'active'
                    && ($workspace->last_update_at === null || $workspace->last_update_at->lt($staleBefore)),
                'target_date' => $workspace->target_date?->toDateString(),
                'lead' => $workspace->lead_user_id !== null ? $leads->get($workspace->lead_user_id) : null,
            ])
            ->values()
            ->all();
    }
}
