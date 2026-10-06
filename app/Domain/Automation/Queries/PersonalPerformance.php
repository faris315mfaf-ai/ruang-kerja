<?php

namespace App\Domain\Automation\Queries;

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\MetricDefinitions\AttendanceDiscipline;
use App\Domain\Analytics\MetricDefinitions\CompletionRate;
use App\Domain\Analytics\MetricDefinitions\LeadTimeMedian;
use App\Domain\Analytics\MetricDefinitions\OnTimeRate;
use App\Domain\Analytics\MetricDefinitions\OverdueTasks;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * "Kinerja saya" (/kinerja, F2-4): the PRD M7 output metrics of one person,
 * side by side and never combined into a score (ADR #8). Every number comes
 * from App\Domain\Analytics\MetricDefinitions on MetricScope::personal-like
 * scopes; this class only picks the periods and shapes the props
 * (resources/js/features/automation/types.ts PerformanceProps).
 *
 * Periods: "8 minggu" = the 8 Monday weeks ending with the current one,
 * "Bulan ini" / "Kuartal" = the PeriodPreset month / quarter; all counted up
 * to today. The weekly chart and the attendance panel follow the period.
 *
 * Someone else's page (direct manager, HR; PerformancePolicy) is measured
 * through the person's own workspace access but never includes their
 * personal workspace, and names of workspaces the viewer cannot see are
 * hidden ("Workspace lain") as are their overdue tasks.
 */
final class PersonalPerformance
{
    public const array PERIODS = ['8w', 'month', 'quarter'];

    public function __construct(private readonly MetricCache $cache) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $viewer, User $subject, string $periodKey, CarbonImmutable $now): array
    {
        $periodKey = in_array($periodKey, self::PERIODS, true) ? $periodKey : '8w';
        $self = $viewer->is($subject);
        $scope = new MetricScope($subject, [$subject->id], includePersonal: $self);
        $today = Period::officeDate($now);

        $data = $this->cache->remember('kinerja', $viewer, 'performance', [
            'subject' => $subject->id,
            'period' => $periodKey,
            'today' => $today->toDateString(),
            'scope' => $scope->fingerprint(),
        ], fn (): array => $this->compute($viewer, $subject, $scope, $periodKey, $today, $now));

        $subject->loadMissing('position:id,name');

        return [
            'person' => [
                'id' => $subject->id,
                'name' => $subject->name,
                'title' => $subject->position?->name,
                'is_self' => $self,
            ],
            ...$data,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function compute(User $viewer, User $subject, MetricScope $scope, string $periodKey, CarbonImmutable $today, CarbonImmutable $now): array
    {
        [$period, $weeks, $label] = $this->periods($periodKey, $now);

        $completion = (new CompletionRate)->compute($scope, $period);
        $onTime = new OnTimeRate;
        $onTimeValue = $onTime->compute($scope, $period);
        $lead = (new LeadTimeMedian)->compute($scope, $period);
        $discipline = (new AttendanceDiscipline)->compute($scope, $period);
        $weekly = $onTime->series($scope, $weeks);

        return [
            'period' => $periodKey,
            'period_label' => $period->label(),
            'counts' => [
                'label' => $label,
                'due' => (int) $completion->denominator,
                'done_of_due' => (int) $completion->numerator,
                'done_with_due' => (int) $onTimeValue->denominator,
                'on_time' => (int) $onTimeValue->numerator,
                'lead_time' => $lead->rounded(1),
                'lead_time_samples' => (int) $lead->denominator,
                'division_lead_time' => $this->divisionLeadTime($subject, $period),
                'scheduled_days' => (int) $discipline->denominator,
                'on_time_days' => (int) $discipline->numerator,
                'attendance_label' => $period->label(),
            ],
            'weeks' => array_map(fn (Period $week, int $index): array => [
                'week_start' => $week->startDate(),
                'on_time' => (int) $weekly[$index]->numerator,
                'late' => (int) ($weekly[$index]->denominator - $weekly[$index]->numerator),
            ], $weeks, array_keys($weeks)),
            'by_workspace' => $this->byWorkspace($viewer, $scope, $period),
            ...$this->overdue($viewer, $scope, $today),
            'attendance' => [
                'label' => $period->label(),
                'on_time_rate' => $discipline->rounded(),
                'average_check_in' => $this->averageCheckIn($subject, $period),
            ],
        ];
    }

    /**
     * @return array{0: Period, 1: list<Period>, 2: string}
     */
    private function periods(string $key, CarbonImmutable $now): array
    {
        if ($key === '8w') {
            $weeks = Period::weeksEndingAt($now, 8);
            $period = (new Period(PeriodPreset::Custom, $weeks[0]->start, $weeks[7]->end))->toDate($now);

            return [$period, $weeks, '8 minggu'];
        }

        $preset = $key === 'month' ? PeriodPreset::Month : PeriodPreset::Quarter;
        $period = Period::resolve($preset, null, null, $now)->toDate($now);
        $firstMonday = $period->start->startOfWeek(CarbonInterface::MONDAY);
        $currentMonday = Period::officeDate($now)->startOfWeek(CarbonInterface::MONDAY);
        $count = (int) round($firstMonday->diffInDays($currentMonday) / 7) + 1;

        return [$period, Period::weeksEndingAt($now, max(1, $count)), $preset->label()];
    }

    /**
     * Median lead time of the person's division (context, not a target).
     */
    private function divisionLeadTime(User $subject, Period $period): ?float
    {
        if ($subject->division_id === null) {
            return null;
        }

        /** @var list<string> $ids */
        $ids = User::query()->where('division_id', $subject->division_id)->active()->pluck('id')->all();

        return (new LeadTimeMedian)->compute(new MetricScope($subject, $ids), $period)->rounded(1);
    }

    /**
     * Tasks finished in the period per workspace (most first).
     *
     * @return list<array{workspace: array{id: string, key: string, name: string, color: string}, done: int}>
     */
    private function byWorkspace(User $viewer, MetricScope $scope, Period $period): array
    {
        $rows = $scope->tasks()
            ->toBase()
            ->join('workspaces', 'workspaces.id', '=', 'tasks.workspace_id')
            ->where('tasks.status_category', TaskStatusCategory::Done->value)
            ->where('tasks.completed_at', '>=', $period->startUtc()->toIso8601String())
            ->where('tasks.completed_at', '<', $period->endUtc()->toIso8601String())
            ->groupBy('workspaces.id', 'workspaces.key', 'workspaces.name', 'workspaces.color', 'workspaces.type')
            ->orderByDesc(DB::raw('count(*)'))
            ->orderBy('workspaces.name')
            ->get(['workspaces.id', 'workspaces.key', 'workspaces.name', 'workspaces.color', 'workspaces.type', DB::raw('count(*) as done')]);

        /** @var list<string> $ids */
        $ids = $rows->pluck('id')->map(fn (mixed $id): string => (string) $id)->values()->all();
        $visible = $this->visibleWorkspaceIds($viewer, $ids);
        $items = [];
        $hidden = 0;

        foreach ($rows as $row) {
            if (! isset($visible[$row->id])) {
                $hidden += (int) $row->done;

                continue;
            }

            $items[] = [
                'workspace' => [
                    'id' => (string) $row->id,
                    'key' => (string) $row->key,
                    'name' => $row->type === 'personal' ? 'Pribadi' : (string) $row->name,
                    'color' => (string) ($row->color ?? 'gray'),
                ],
                'done' => (int) $row->done,
            ];
        }

        if ($hidden > 0) {
            $items[] = ['workspace' => ['id' => 'lainnya', 'key' => '…', 'name' => 'Workspace lain', 'color' => 'gray'], 'done' => $hidden];
        }

        return $items;
    }

    /**
     * Open tasks past their due date today (a snapshot, not tied to the period).
     *
     * @return array{overdue: array<int, array{key: string, title: string, due_date: string, url: string}>, overdue_count: int}
     */
    private function overdue(User $viewer, MetricScope $scope, CarbonImmutable $today): array
    {
        $tasks = (new OverdueTasks)->query($scope, $today)
            ->with('workspace:id,key')
            ->orderBy('tasks.due_date')
            ->orderBy('tasks.id')
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.due_date']);

        $visible = $this->visibleWorkspaceIds($viewer, array_values(array_unique($tasks->map(fn (Task $task): string => $task->workspace_id)->all())));

        return [
            'overdue' => $tasks
                ->filter(fn (Task $task): bool => isset($visible[$task->workspace_id]))
                ->take(10)
                ->map(fn (Task $task): array => [
                    'key' => $task->displayKey(),
                    'title' => $task->title,
                    'due_date' => (string) $task->due_date?->toDateString(),
                    'url' => $task->url(),
                ])
                ->values()
                ->all(),
            'overdue_count' => $tasks->count(),
        ];
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, true>
     */
    private function visibleWorkspaceIds(User $viewer, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return array_fill_keys(
            Workspace::query()->visibleTo($viewer)->whereIn('workspaces.id', $ids)->pluck('workspaces.id')->all(),
            true,
        );
    }

    /**
     * Average check-in time of day ("07.52", office time) in the period.
     */
    private function averageCheckIn(User $subject, Period $period): ?string
    {
        $seconds = DB::table('attendance_days')
            ->where('user_id', $subject->id)
            ->whereNotNull('check_in_at')
            ->where('work_date', '>=', $period->startDate())
            ->where('work_date', '<', $period->endDate())
            ->selectRaw('avg(extract(epoch from (check_in_at at time zone ?)::time)) as seconds', [config()->string('app.office_timezone')])
            ->value('seconds');

        if ($seconds === null) {
            return null;
        }

        $minutes = (int) round((float) $seconds / 60);

        return sprintf('%02d.%02d', intdiv($minutes, 60) % 24, $minutes % 60);
    }
}
