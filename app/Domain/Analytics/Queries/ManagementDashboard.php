<?php

namespace App\Domain\Analytics\Queries;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\MetricDefinitions\AttendanceRate;
use App\Domain\Analytics\MetricDefinitions\CompletionRate;
use App\Domain\Analytics\MetricDefinitions\OnTimeRate;
use App\Domain\Analytics\MetricDefinitions\OverdueTasks;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Projects\Data\ProjectMetricsData;
use App\Domain\Projects\Enums\MilestoneStatus;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Queries\ProjectMetrics;
use App\Domain\Projects\Services\ProjectClock;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;

/**
 * Dashboard Manajemen (`/manajemen`, design MgDashboard / MgPDashboard):
 * company summary for `dashboard.view_company` (Direksi, HR, Super Admin).
 *
 * All three periods are computed in one go so the client switches the
 * Harian / Mingguan / Bulanan tabs without a request:
 *
 * - harian   = today (office date);
 * - mingguan = the last full Mon–Fri work week (on Saturday and Sunday the
 *   week that just ended), compared with the work week before;
 * - bulanan  = the last four Mon–Fri work weeks ending with that week,
 *   compared with the four before. Totals are the sum of the weekly buckets,
 *   so the chart columns always add up to the KPI.
 *
 * Every number comes from an existing definition: TodayAttendance (via
 * HrDashboard::today), CompletionRate (done ÷ due in period = "tugas selesai
 * dari rencana"), OnTimeRate, OverdueTasks, AttendanceRate and, for
 * projects, Workspace::portfolioFor + ProjectMetrics (progress, flags,
 * milestone status). People come from User::visibleTo($viewer), tasks from
 * workspaces the viewer may see (MetricScope).
 *
 * Both blocks are cached 5 minutes per viewer (MetricCache).
 */
final class ManagementDashboard
{
    public const string CACHE_KEY = 'manajemen';

    /** Project rows in "Tracking per proyek". */
    public const int PROJECT_ROWS = 8;

    /** Columns of the "per divisi" chart; the rest is folded into "Divisi lain". */
    public const int CHART_DIVISIONS = 7;

    private const array WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    private const array WEEKDAYS_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    /** Legal forms and connectives left out of the company short name. */
    private const array LEGAL_FORMS = ['pt', 'cv', 'tbk', 'persero', 'ud', 'pd', 'yayasan', 'koperasi', 'dan', 'and', 'of', 'the', 'untuk'];

    public function __construct(
        private readonly MetricCache $cache,
        private readonly HrDashboard $hr,
        private readonly ProjectMetrics $projectMetrics,
    ) {}

    /**
     * The office-date periods of the three tabs.
     *
     * @return array{harian: Period, mingguan: Period, bulanan: Period}
     */
    public static function periods(CarbonInterface $now): array
    {
        $today = Period::officeDate($now);
        $week = self::lastWorkWeek($today);

        return [
            'harian' => new Period(PeriodPreset::Custom, $today, $today->addDay()),
            'mingguan' => $week,
            'bulanan' => new Period(PeriodPreset::Custom, $week->start->subWeeks(3), $week->end),
        ];
    }

    /**
     * Monday–Friday of the last work week that is over: the previous week on
     * Monday–Friday, the current one on Saturday and Sunday.
     */
    public static function lastWorkWeek(CarbonImmutable $today): Period
    {
        $monday = $today->startOfWeek(CarbonInterface::MONDAY);
        $start = $today->dayOfWeekIso >= 6 ? $monday : $monday->subWeek();

        return new Period(PeriodPreset::Custom, $start, $start->addDays(5));
    }

    /**
     * Page header (not deferred): company badge and the date.
     *
     * @return array{company: string, today: string}
     */
    public function header(User $viewer, CarbonImmutable $now): array
    {
        $company = Company::query()->whereKey($viewer->company_id)->first(['id', 'name', 'settings']);
        $override = $company?->settings['short_name'] ?? null;

        return [
            'company' => is_string($override) && trim($override) !== ''
                ? trim($override)
                : self::shortName($company !== null ? $company->name : config()->string('branding.short_name', 'RK')),
            'today' => Period::officeDate($now)->toDateString(),
        ];
    }

    /**
     * "SPKD" for "PT Sistem Pelayanan Kesehatan dan Data": initials without
     * the legal form and connectives; short names (≤ 14 characters) are kept as they are.
     */
    public static function shortName(string $name): string
    {
        $clean = trim((string) preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $name));
        $words = array_values(array_filter(
            preg_split('/\s+/u', $clean) ?: [],
            fn (string $word): bool => $word !== '' && ! in_array(mb_strtolower($word), self::LEGAL_FORMS, true),
        ));

        if ($words === []) {
            return mb_substr(trim($name), 0, 14);
        }

        $joined = implode(' ', $words);

        if (count($words) === 1 || mb_strlen($joined) <= 14) {
            return mb_substr($joined, 0, 14);
        }

        return mb_strtoupper(implode('', array_map(fn (string $word): string => mb_substr($word, 0, 1), $words)));
    }

    /**
     * Deferred + cached: KPIs and chart of the three periods and today's
     * attendance.
     *
     * @return array<string, mixed>
     */
    public function summary(User $viewer, CarbonImmutable $now): array
    {
        $people = $this->people($viewer);
        $scope = new MetricScope($viewer, array_values(array_map('strval', $people->modelKeys())));

        return $this->cache->remember(
            self::CACHE_KEY,
            $viewer,
            'summary',
            ['today' => Period::officeDate($now)->toDateString(), 'scope' => $scope->fingerprint()],
            fn (): array => $this->computeSummary($scope, $people, $now),
        );
    }

    /**
     * Deferred + cached: active projects, "perlu perhatian" and this
     * month's milestones, within Workspace::portfolioFor($viewer).
     *
     * @return array<string, mixed>
     */
    public function portfolio(User $viewer, CarbonImmutable $now): array
    {
        $today = CarbonImmutable::parse(ProjectClock::date($now));

        return $this->cache->remember(
            self::CACHE_KEY,
            $viewer,
            'portfolio',
            ['today' => $today->toDateString()],
            fn (): array => $this->computePortfolio($viewer, $today, $now),
        );
    }

    /**
     * @return Collection<int, User>
     */
    private function people(User $viewer): Collection
    {
        return User::query()
            ->visibleTo($viewer)
            ->active()
            ->with('division:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_url', 'company_id', 'division_id']);
    }

    /**
     * @param  Collection<int, User>  $people
     * @return array<string, mixed>
     */
    private function computeSummary(MetricScope $scope, Collection $people, CarbonImmutable $now): array
    {
        $periods = self::periods($now);
        $today = $periods['harian']->start;
        $attendance = $this->hr->today($people, $now);
        $counts = $attendance['counts'];

        return [
            'generated_at' => $now->toIso8601String(),
            'attendance' => [
                'date' => $attendance['date'],
                'counts' => [
                    'scheduled' => $counts['scheduled'],
                    'present' => $counts['present'],
                    'on_time' => $counts['present'] - $counts['late'],
                    'late' => $counts['late'],
                    'away' => $counts['away'],
                    'not_checked_in' => $counts['not_checked_in'],
                    'absent' => $counts['absent'],
                ],
                'divisions' => array_map(fn (array $division): array => [
                    'id' => $division['id'],
                    'name' => $division['name'],
                    'scheduled' => $division['scheduled'],
                    'present' => $division['present'],
                ], $attendance['divisions']),
            ],
            'periods' => [
                'harian' => $this->daily($scope, $people, $periods['harian'], $today, $counts),
                'mingguan' => $this->weekly($scope, $periods['mingguan']),
                'bulanan' => $this->monthly($scope, $periods['bulanan']),
            ],
        ];
    }

    /**
     * @param  Collection<int, User>  $people
     * @param  array{scheduled: int, present: int, late: int, not_checked_in: int}  $counts
     * @return array<string, mixed>
     */
    private function daily(MetricScope $scope, Collection $people, Period $period, CarbonImmutable $today, array $counts): array
    {
        $completion = new CompletionRate;
        $overdue = new OverdueTasks;
        $columns = [];
        $overdueByDivision = [];

        foreach ($this->divisionGroups($people) as $group) {
            $divisionScope = new MetricScope($scope->viewer, $group['ids']);
            $value = $completion->compute($divisionScope, $period);
            $late = (int) $overdue->compute($divisionScope, $today)->value;

            if ($late > 0) {
                $overdueByDivision[] = ['name' => $group['name'], 'count' => $late];
            }

            if ($value->denominator > 0) {
                $columns[] = ['key' => $group['key'], 'label' => $group['name'], 'full_label' => $group['name'], 'planned' => (int) $value->denominator, 'done' => (int) $value->numerator, 'ids' => $group['ids']];
            }
        }

        usort($overdueByDivision, fn (array $a, array $b): int => [$b['count'], $a['name']] <=> [$a['count'], $b['name']]);

        return [
            'range' => self::range($period),
            'attendance' => [
                'kind' => 'today',
                'present' => $counts['present'],
                'scheduled' => $counts['scheduled'],
                'rate' => MetricValue::percentage($counts['present'], $counts['scheduled'])->rounded(),
                'late' => $counts['late'],
                'not_checked_in' => $counts['not_checked_in'],
            ],
            'tasks' => self::tasks($completion->compute($scope, $period)),
            'overdue' => [
                'count' => (int) $overdue->compute($scope, $today)->value,
                'top_division' => $overdueByDivision[0] ?? null,
            ],
            'on_time' => null,
            'chart' => $this->divisionColumns($scope, $columns, $period),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function weekly(MetricScope $scope, Period $week): array
    {
        $days = [];

        for ($day = $week->start; $day->lt($week->end); $day = $day->addDay()) {
            $days[] = new Period(PeriodPreset::Custom, $day, $day->addDay());
        }

        $previous = new Period(PeriodPreset::Custom, $week->start->subWeek(), $week->end->subWeek());
        $completion = (new CompletionRate)->series($scope, $days);
        $onTime = new OnTimeRate;

        return [
            'range' => self::range($week),
            'attendance' => self::average((new AttendanceRate)->compute($scope, $week)),
            'tasks' => self::tasks(self::sum($completion)),
            'overdue' => null,
            'on_time' => [
                ...$onTime->compute($scope, $week)->compareTo($onTime->compute($scope, $previous)),
                'previous_range' => self::range($previous),
            ],
            'chart' => array_map(fn (Period $day, int $index): array => [
                'key' => $day->startDate(),
                'label' => self::WEEKDAYS[$day->start->dayOfWeekIso - 1].' '.$day->start->day,
                'full_label' => self::WEEKDAYS_LONG[$day->start->dayOfWeekIso - 1].', '.$day->label(),
                'planned' => (int) $completion[$index]->denominator,
                'done' => (int) $completion[$index]->numerator,
            ], $days, array_keys($days)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function monthly(MetricScope $scope, Period $range): array
    {
        $weeks = [];
        $previousWeeks = [];

        for ($start = $range->start; $start->lt($range->end); $start = $start->addWeek()) {
            $weeks[] = new Period(PeriodPreset::Custom, $start, $start->addDays(5));
            $previousWeeks[] = new Period(PeriodPreset::Custom, $start->subWeeks(4), $start->subWeeks(4)->addDays(5));
        }

        $all = [...$previousWeeks, ...$weeks];
        $count = count($weeks);
        $completion = (new CompletionRate)->series($scope, $weeks);
        $onTime = (new OnTimeRate)->series($scope, $all);
        $attendance = (new AttendanceRate)->series($scope, $weeks);
        $previousRange = new Period(PeriodPreset::Custom, $range->start->subWeeks(4), $range->end->subWeeks(4));

        return [
            'range' => self::range($range),
            'attendance' => self::average(self::sum($attendance)),
            'tasks' => self::tasks(self::sum($completion)),
            'overdue' => null,
            'on_time' => [
                ...self::sum(array_slice($onTime, $count))->compareTo(self::sum(array_slice($onTime, 0, $count))),
                'previous_range' => self::range($previousRange),
            ],
            'chart' => array_map(fn (Period $week, int $index): array => [
                'key' => $week->startDate(),
                'label' => 'Mg '.$week->start->isoWeek(),
                'full_label' => 'Minggu '.$week->start->isoWeek().', '.$week->label(),
                'planned' => (int) $completion[$index]->denominator,
                'done' => (int) $completion[$index]->numerator,
            ], $weeks, array_keys($weeks)),
        ];
    }

    /**
     * People grouped by their division (alphabetical, "Tanpa divisi" last).
     *
     * @param  Collection<int, User>  $people
     * @return list<array{key: string, name: string, ids: list<string>}>
     */
    private function divisionGroups(Collection $people): array
    {
        $groups = [];

        foreach ($people as $person) {
            $key = $person->division_id ?? 'none';
            $groups[$key] ??= ['key' => $key, 'name' => $person->division !== null ? $person->division->name : 'Tanpa divisi', 'ids' => []];
            $groups[$key]['ids'][] = (string) $person->id;
        }

        $groups = array_values($groups);
        usort($groups, fn (array $a, array $b): int => [$a['key'] === 'none', $a['name']] <=> [$b['key'] === 'none', $b['name']]);

        return $groups;
    }

    /**
     * Busiest divisions first; beyond CHART_DIVISIONS the rest is measured
     * again as one "Divisi lain" scope (a task shared by two of them counts once).
     *
     * @param  list<array{key: string, label: string, full_label: string, planned: int, done: int, ids: list<string>}>  $columns
     * @return list<array{key: string, label: string, full_label: string, planned: int, done: int}>
     */
    private function divisionColumns(MetricScope $scope, array $columns, Period $period): array
    {
        usort($columns, fn (array $a, array $b): int => [$b['planned'], $a['label']] <=> [$a['planned'], $b['label']]);

        if (count($columns) > self::CHART_DIVISIONS) {
            $rest = array_slice($columns, self::CHART_DIVISIONS - 1);
            $columns = array_slice($columns, 0, self::CHART_DIVISIONS - 1);
            $value = (new CompletionRate)->compute(new MetricScope($scope->viewer, array_merge(...array_column($rest, 'ids'))), $period);
            $columns[] = ['key' => 'other', 'label' => 'Divisi lain', 'full_label' => 'Divisi lain ('.count($rest).')', 'planned' => (int) $value->denominator, 'done' => (int) $value->numerator, 'ids' => []];
        }

        return array_map(fn (array $column): array => [
            'key' => $column['key'],
            'label' => $column['label'],
            'full_label' => $column['full_label'],
            'planned' => $column['planned'],
            'done' => $column['done'],
        ], $columns);
    }

    /**
     * @return array<string, mixed>
     */
    private function computePortfolio(User $viewer, CarbonImmutable $today, CarbonImmutable $now): array
    {
        $projects = Workspace::query()
            ->portfolioFor($viewer)
            ->whereNull('archived_at')
            ->with(['lead:id,name', 'division:id,name'])
            ->get();
        $projects = $projects->reject(fn (Workspace $workspace): bool => ProjectMetrics::status($workspace) === ProjectStatus::Canceled)->values();
        $metrics = $this->projectMetrics->forWorkspaces($projects, $today);

        $active = $projects
            ->filter(fn (Workspace $workspace): bool => ProjectMetrics::status($workspace) === ProjectStatus::Active)
            ->sortBy(fn (Workspace $workspace): string => sprintf(
                '%d|%s|%s',
                $workspace->health?->rank() ?? 1,
                $workspace->target_date?->toDateString() ?? '9999-12-31',
                mb_strtolower($workspace->name),
            ))
            ->values();

        $attention = $active
            ->filter(fn (Workspace $workspace): bool => self::needsAttention($workspace, $metrics[$workspace->id]))
            ->map(fn (Workspace $workspace): array => [
                'key' => $workspace->key,
                'name' => $workspace->name,
                'reason' => self::attentionReason($workspace, $metrics[$workspace->id]),
            ])
            ->values()
            ->all();

        return [
            'generated_at' => $now->toIso8601String(),
            'total' => $active->count(),
            'projects' => $active->take(self::PROJECT_ROWS)
                ->map(fn (Workspace $workspace): array => $this->projectRow($workspace, $metrics[$workspace->id], $today))
                ->values()
                ->all(),
            'attention' => ['count' => count($attention), 'items' => $attention],
            'milestones' => $this->monthMilestones($projects, $metrics, $today),
        ];
    }

    /**
     * PIC health "Berisiko"/"Bermasalah" or any system flag (ProjectFlags:
     * tertinggal, milestone terlewat, update kedaluwarsa).
     */
    public static function needsAttention(Workspace $workspace, ProjectMetricsData $metrics): bool
    {
        return in_array($workspace->health, [ProjectHealth::AtRisk, ProjectHealth::OffTrack], true) || $metrics->flags !== [];
    }

    private static function attentionReason(Workspace $workspace, ProjectMetricsData $metrics): string
    {
        if (in_array($workspace->health, [ProjectHealth::AtRisk, ProjectHealth::OffTrack], true)) {
            return mb_strtolower($workspace->health->label());
        }

        return mb_strtolower(($metrics->flags[0] ?? null)?->label() ?? '');
    }

    /**
     * @return array<string, mixed>
     */
    private function projectRow(Workspace $workspace, ProjectMetricsData $metrics, CarbonImmutable $today): array
    {
        $missed = $metrics->missedMilestones()[0] ?? null;
        $next = $metrics->nextMilestone();
        $milestone = $missed ?? $next;

        return [
            'id' => $workspace->id,
            'key' => $workspace->key,
            'name' => $workspace->name,
            'color' => $workspace->color ?? 'gray',
            'url' => '/w/'.$workspace->key.'/ringkasan',
            'division' => $workspace->division?->name,
            'lead' => $workspace->lead?->name,
            'health' => $workspace->health?->value,
            'actual' => $metrics->actual,
            'planned' => $metrics->planned,
            'flags' => $metrics->flagValues(),
            'attention' => self::needsAttention($workspace, $metrics),
            'milestone' => $milestone === null ? null : [
                'name' => $milestone['name'],
                'target_date' => $milestone['target_date'],
                'missed' => $missed !== null,
                'days_left' => ProjectClock::daysBetween($today, CarbonImmutable::parse($milestone['target_date'])),
            ],
        ];
    }

    /**
     * Milestones of the viewer's projects due this calendar month: done (✓),
     * missed (!), the next one to reach, and the rest.
     *
     * @param  Collection<int, Workspace>  $projects
     * @param  array<string, ProjectMetricsData>  $metrics
     * @return array<string, mixed>
     */
    private function monthMilestones(Collection $projects, array $metrics, CarbonImmutable $today): array
    {
        $from = $today->startOfMonth()->toDateString();
        $to = $today->endOfMonth()->toDateString();
        $items = [];

        foreach ($projects as $workspace) {
            foreach ($metrics[$workspace->id]->milestones as $milestone) {
                if ($milestone['target_date'] < $from || $milestone['target_date'] > $to) {
                    continue;
                }

                $items[] = [
                    'id' => $milestone['id'],
                    'name' => $milestone['name'],
                    'target_date' => $milestone['target_date'],
                    'project' => ['key' => $workspace->key, 'name' => $workspace->name, 'url' => '/w/'.$workspace->key.'/ringkasan'],
                    'state' => match (true) {
                        $milestone['status']->isDone() => 'done',
                        $milestone['status'] === MilestoneStatus::Missed => 'missed',
                        default => 'todo',
                    },
                ];
            }
        }

        usort($items, fn (array $a, array $b): int => [$a['target_date'], $a['project']['key'], $a['name']] <=> [$b['target_date'], $b['project']['key'], $b['name']]);

        foreach ($items as $index => $item) {
            if ($item['state'] === 'todo') {
                $items[$index]['state'] = 'next';
                break;
            }
        }

        return [
            'month' => ProjectClock::monthName($today->month),
            'from' => $from,
            'to' => $to,
            'done' => count(array_filter($items, fn (array $item): bool => $item['state'] === 'done')),
            'total' => count($items),
            'items' => $items,
        ];
    }

    /**
     * @return array{from: string, to: string, label: string}
     */
    private static function range(Period $period): array
    {
        return ['from' => $period->startDate(), 'to' => $period->lastDate(), 'label' => $period->label()];
    }

    /**
     * @return array{done: int, planned: int, rate: float|null}
     */
    private static function tasks(MetricValue $value): array
    {
        return ['done' => (int) $value->numerator, 'planned' => (int) $value->denominator, 'rate' => $value->rounded()];
    }

    /**
     * @return array{kind: string, attended: int, scheduled: int, rate: float|null}
     */
    private static function average(MetricValue $value): array
    {
        return ['kind' => 'average', 'attended' => (int) $value->numerator, 'scheduled' => (int) $value->denominator, 'rate' => $value->rounded()];
    }

    /**
     * Rate over several buckets: Σ numerator ÷ Σ denominator.
     *
     * @param  list<MetricValue>  $values
     */
    private static function sum(array $values): MetricValue
    {
        return MetricValue::percentage(
            array_sum(array_map(fn (MetricValue $value): float => $value->numerator, $values)),
            array_sum(array_map(fn (MetricValue $value): float => $value->denominator, $values)),
        );
    }
}
