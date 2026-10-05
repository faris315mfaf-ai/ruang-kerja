<?php

namespace App\Domain\Projects\Queries;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Projects\Data\PortfolioFilters;
use App\Domain\Projects\Data\ProjectMetricsData;
use App\Domain\Projects\Enums\MilestoneStatus;
use App\Domain\Projects\Enums\ProjectFlag;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Projects\Services\ProjectPresenter;
use App\Http\Resources\WorkspaceResource;
use App\Models\Division;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Dashboard Direksi = portofolio proyek (mockups DashboardDireksi /
 * MDashboardDireksi, PRD M7 & M10). Scope: Workspace::portfolioFor($viewer).
 * The query count does not grow with the number of projects.
 */
final class PortfolioDashboard
{
    /** Roadmap: two months back and two months ahead of the current month (Agu–Des in Oktober). */
    public const int ROADMAP_MONTHS_BEFORE = 2;

    public const int ROADMAP_MONTHS_AFTER = 2;

    public const int UPCOMING_MILESTONE_DAYS = 14;

    public const int FEED_SIZE = 6;

    public function __construct(private readonly ProjectMetrics $metrics) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $viewer, PortfolioFilters $filters, ?CarbonImmutable $today = null): array
    {
        $today ??= ProjectClock::today();
        $range = $filters->range($today);

        $all = Workspace::query()
            ->portfolioFor($viewer)
            ->whereNull('archived_at')
            ->with(['lead:id,name,avatar_url', 'sponsor:id,name,avatar_url', 'division:id,name'])
            ->get();

        $open = $all->filter(fn (Workspace $workspace): bool => ProjectMetrics::status($workspace)->isOpen());
        $closed = $all->reject(fn (Workspace $workspace): bool => ProjectMetrics::status($workspace)->isOpen());

        // Period: open projects whose [start, target] overlaps it. Compared as
        // office date strings: the range is in office time, the date casts are
        // not, so instants would drop a project starting on the last day.
        if ($range !== null) {
            [$from, $to] = [$range[0]->toDateString(), $range[1]->toDateString()];
            $open = $open->filter(fn (Workspace $workspace): bool => ($workspace->start_date === null || $workspace->start_date->toDateString() <= $to)
                && ($workspace->target_date === null || $workspace->target_date->toDateString() >= $from));
            // Recently finished: since the start of the previous quarter ("2 proyek selesai di Q3").
            $since = $today->startOfQuarter()->subQuarter()->toDateString();
            $closed = $closed->filter(fn (Workspace $workspace): bool => $workspace->completed_at !== null
                && ProjectClock::date($workspace->completed_at) >= $since);
        }

        $divisionOptions = $this->divisionOptions($all);

        if ($filters->divisionId !== null) {
            $open = $open->where('division_id', $filters->divisionId);
            $closed = $closed->where('division_id', $filters->divisionId);
        }

        $metrics = $this->metrics->forWorkspaces($open->concat($closed), $today);
        $healthCounts = $this->healthCounts($open);

        $listed = $filters->archive ? $closed : $open;

        if ($filters->health !== null && ! $filters->archive) {
            $listed = $listed->filter(fn (Workspace $workspace): bool => $workspace->health === $filters->health);
        }

        $listed = $listed->sortBy(fn (Workspace $workspace): string => sprintf(
            '%d|%s|%s',
            $workspace->health?->rank() ?? 1,
            $workspace->target_date?->toDateString() ?? '9999-12-31',
            mb_strtolower($workspace->name),
        ))->values();

        $openIds = array_values($open->map(fn (Workspace $workspace): string => $workspace->id)->all());
        $canSteer = $viewer->hasPermission(Permission::PortfolioView);

        return [
            'as_of' => $today->toDateString(),
            'period_label' => $filters->label($today),
            'filters' => $filters->toArray(),
            'division_options' => $divisionOptions,
            'can' => ['steer' => $canSteer],
            'kpis' => $this->kpis($open, $metrics, $healthCounts, $today),
            'projects' => $listed->map(fn (Workspace $workspace): array => ProjectPresenter::project($workspace, $metrics[$workspace->id]))->all(),
            'completed' => $closed->filter(fn (Workspace $workspace): bool => ProjectMetrics::status($workspace) === ProjectStatus::Completed)
                ->sortBy('completed_at')
                ->map(fn (Workspace $workspace): array => [
                    ...WorkspaceResource::reference($workspace),
                    'completed_at' => $workspace->completed_at?->toIso8601String(),
                    'quarter' => $workspace->completed_at !== null ? 'Q'.CarbonImmutable::parse(ProjectClock::date($workspace->completed_at))->quarter : null,
                ])
                ->values()
                ->all(),
            'roadmap' => $this->roadmap($open->sortBy(fn (Workspace $workspace): string => sprintf('%d|%s', $workspace->health?->rank() ?? 1, $workspace->target_date?->toDateString() ?? '9999')), $metrics, $today),
            'decisions' => $this->decisions($openIds, $open, $canSteer),
            'attention' => $this->attention($open, $metrics, $viewer),
            'feed' => $this->feed($openIds, $open),
            'attendance' => $canSteer ? $this->attendance($viewer, $today) : null,
        ];
    }

    /**
     * @param  Collection<int, Workspace>  $projects
     * @return list<array{value: string, label: string}>
     */
    private function divisionOptions(Collection $projects): array
    {
        $ids = $projects->pluck('division_id')->filter()->unique()->values()->all();

        if ($ids === []) {
            return [];
        }

        return array_values(Division::query()->whereKey($ids)->orderBy('name')->get(['id', 'name'])
            ->map(fn (Division $division): array => ['value' => $division->id, 'label' => $division->name])
            ->all());
    }

    /**
     * @param  Collection<int, Workspace>  $projects
     * @return array{on_track: int, at_risk: int, off_track: int, none: int}
     */
    private function healthCounts(Collection $projects): array
    {
        $counts = ['on_track' => 0, 'at_risk' => 0, 'off_track' => 0, 'none' => 0];

        foreach ($projects as $workspace) {
            $counts[$workspace->health->value ?? 'none']++;
        }

        return $counts;
    }

    /**
     * @param  Collection<int, Workspace>  $open
     * @param  array<string, ProjectMetricsData>  $metrics
     * @param  array{on_track: int, at_risk: int, off_track: int, none: int}  $healthCounts
     * @return array<string, mixed>
     */
    private function kpis(Collection $open, array $metrics, array $healthCounts, CarbonImmutable $today): array
    {
        $horizon = $today->addDays(self::UPCOMING_MILESTONE_DAYS)->toDateString();
        $upcoming = [];
        $missed = [];
        $overdueTotal = 0;
        $overdueProjects = 0;
        $top = null;

        foreach ($open as $workspace) {
            $data = $metrics[$workspace->id];

            foreach ($data->milestones as $milestone) {
                if ($milestone['status'] === MilestoneStatus::Missed) {
                    $missed[] = ['key' => $workspace->key, 'name' => $milestone['name'], 'target_date' => $milestone['target_date']];
                } elseif (! $milestone['status']->isDone() && $milestone['target_date'] <= $horizon) {
                    $upcoming[] = ['key' => $workspace->key, 'name' => $milestone['name'], 'target_date' => $milestone['target_date']];
                }
            }

            $overdue = $data->totals->overdue;
            $overdueTotal += $overdue;

            if ($overdue > 0) {
                $overdueProjects++;

                if ($top === null || $overdue > $top['count']) {
                    $top = ['key' => $workspace->key, 'count' => $overdue];
                }
            }
        }

        usort($upcoming, fn (array $a, array $b): int => strcmp($a['target_date'], $b['target_date']));
        usort($missed, fn (array $a, array $b): int => strcmp($a['target_date'], $b['target_date']));

        return [
            'active' => ['count' => $open->count(), 'health' => $healthCounts],
            'upcoming_milestones' => ['count' => count($upcoming), 'items' => array_slice($upcoming, 0, 6)],
            'missed_milestones' => ['count' => count($missed), 'items' => array_slice($missed, 0, 4)],
            'overdue_tasks' => ['count' => $overdueTotal, 'projects' => $overdueProjects, 'total_projects' => $open->count(), 'top' => $top],
        ];
    }

    /**
     * Timeline rows (mockup "Linimasa"): bar from start to target, milestones,
     * today line. Window: ROADMAP_MONTHS_BEFORE … ROADMAP_MONTHS_AFTER.
     *
     * @param  Collection<int, Workspace>  $projects
     * @param  array<string, ProjectMetricsData>  $metrics
     * @return array<string, mixed>
     */
    private function roadmap(Collection $projects, array $metrics, CarbonImmutable $today): array
    {
        $from = $today->startOfMonth()->subMonths(self::ROADMAP_MONTHS_BEFORE);
        $to = $today->startOfMonth()->addMonths(self::ROADMAP_MONTHS_AFTER)->endOfMonth()->startOfDay();
        $months = [];

        for ($month = $from; $month->lte($to); $month = $month->addMonth()) {
            $months[] = ['start' => $month->toDateString(), 'label' => ProjectClock::monthName($month->month, short: true)];
        }

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'today' => $today->toDateString(),
            'months' => $months,
            'rows' => $projects->map(fn (Workspace $workspace): array => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'health' => $workspace->health?->value,
                'start_date' => $workspace->start_date?->toDateString(),
                'target_date' => $workspace->target_date?->toDateString(),
                'milestones' => array_map(fn (array $milestone): array => [
                    'id' => $milestone['id'],
                    'name' => $milestone['name'],
                    'target_date' => $milestone['target_date'],
                    'status' => $milestone['status']->value,
                ], $metrics[$workspace->id]->milestones),
            ])->values()->all(),
        ];
    }

    /**
     * "Butuh keputusan Anda": every update whose decision is still open.
     *
     * @param  list<string>  $projectIds
     * @param  Collection<int, Workspace>  $projects
     * @return list<array<string, mixed>>
     */
    private function decisions(array $projectIds, Collection $projects, bool $canSteer): array
    {
        if ($projectIds === []) {
            return [];
        }

        $refs = self::references($projects);

        return array_values(ProjectUpdate::query()
            ->whereIn('workspace_id', $projectIds)
            ->openDecision()
            ->with('author:id,name,avatar_url')
            ->oldest('created_at')
            ->get()
            ->map(function (ProjectUpdate $update) use ($refs, $canSteer): array {
                return [
                    'id' => $update->id,
                    'project' => $refs[$update->workspace_id],
                    'decision' => (string) $update->decision_needed,
                    'summary' => $update->summary,
                    'author' => ProjectPresenter::person($update->author),
                    'created_at' => $update->created_at->toIso8601String(),
                    'can_resolve' => $canSteer,
                ];
            })
            ->all());
    }

    /**
     * "Perlu perhatian": off-track projects and projects without a fresh update
     * (and no open decision already listed).
     *
     * @param  Collection<int, Workspace>  $projects
     * @param  array<string, ProjectMetricsData>  $metrics
     * @return list<array<string, mixed>>
     */
    private function attention(Collection $projects, array $metrics, User $viewer): array
    {
        $items = [];

        foreach ($projects as $workspace) {
            $data = $metrics[$workspace->id];

            if ($workspace->health !== ProjectHealth::OffTrack && ! $data->hasFlag(ProjectFlag::StaleUpdate)) {
                continue;
            }

            $items[] = [
                'project' => WorkspaceResource::reference($workspace),
                'lead' => ProjectPresenter::person($workspace->lead),
                'is_sponsor' => $workspace->sponsor_user_id === $viewer->id,
                'health' => $workspace->health?->value,
                'metrics' => ProjectPresenter::metrics($data),
            ];
        }

        return $items;
    }

    /**
     * "Update terbaru dari PIC".
     *
     * @param  list<string>  $projectIds
     * @param  Collection<int, Workspace>  $projects
     * @return list<array<string, mixed>>
     */
    private function feed(array $projectIds, Collection $projects): array
    {
        if ($projectIds === []) {
            return [];
        }

        $refs = self::references($projects);

        return array_values(ProjectUpdate::query()
            ->whereIn('workspace_id', $projectIds)
            ->with('author:id,name,avatar_url')
            ->latest('created_at')
            ->latest('id')
            ->limit(self::FEED_SIZE)
            ->get()
            ->map(function (ProjectUpdate $update) use ($refs): array {
                return [
                    'id' => $update->id,
                    'project' => $refs[$update->workspace_id],
                    'author' => ProjectPresenter::person($update->author),
                    'health' => $update->health->value,
                    'summary' => $update->summary,
                    'created_at' => $update->created_at->toIso8601String(),
                ];
            })
            ->all());
    }

    /**
     * @param  Collection<int, Workspace>  $projects
     * @return array<string, array{id: string, key: string, name: string, type: string, color: string}>
     */
    private static function references(Collection $projects): array
    {
        $refs = [];

        foreach ($projects as $workspace) {
            $refs[$workspace->id] = WorkspaceResource::reference($workspace);
        }

        return $refs;
    }

    /**
     * The ONE attendance widget (hadir / cuti-izin / belum check-in today),
     * linking to Dashboard HR. Company-wide, active employees.
     *
     * @return array{present: int, total: int, on_leave: int, not_checked_in: int}
     */
    private function attendance(User $viewer, CarbonImmutable $today): array
    {
        $total = User::query()->active()->where('company_id', $viewer->company_id)->count();

        $days = AttendanceDay::query()
            ->whereDate('work_date', $today->toDateString())
            ->whereHas('user', fn (Builder $query) => $query->active()->where('company_id', $viewer->company_id))
            ->get(['id', 'user_id', 'status', 'check_in_at', 'shift_id']);

        $present = $days->filter(fn (AttendanceDay $day): bool => $day->check_in_at !== null)->count();
        $onLeave = $days->filter(fn (AttendanceDay $day): bool => $day->check_in_at === null && $day->status->comesFromRequest())->count();
        $off = $days->filter(fn (AttendanceDay $day): bool => $day->check_in_at === null && $day->status === AttendanceStatus::Holiday)->count();

        return [
            'present' => $present,
            'total' => $total,
            'on_leave' => $onLeave,
            'not_checked_in' => max(0, $total - $present - $onLeave - $off),
        ];
    }
}
