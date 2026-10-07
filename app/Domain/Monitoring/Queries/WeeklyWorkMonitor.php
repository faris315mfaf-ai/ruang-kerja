<?php

namespace App\Domain\Monitoring\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Monitoring\Support\ReportTasks;
use App\Models\DailyReport;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Monitoring kerja mingguan (keputusan pemilik 6 Okt 2026): Monday–Sunday of
 * one office week — per division a matrix person × day (reported or not,
 * items and hours), the tasks most worked on (only tasks the viewer may see)
 * and this week's blockers. Days after today are "future", days without a
 * scheduled shift and without a report are "off".
 *
 * Five queries whatever the number of people or reports.
 */
final class WeeklyWorkMonitor
{
    public const int TOP_TASKS = 8;

    public const int BLOCKERS = 12;

    private const array DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    public function __construct(private readonly ScheduleResolver $schedules) {}

    /**
     * Monday of the week holding `$date` (office date).
     */
    public static function weekStart(CarbonInterface $date): CarbonImmutable
    {
        return Period::officeDate($date)->startOfWeek(CarbonInterface::MONDAY);
    }

    /**
     * @param  Collection<int, User>  $people  active, visible to the viewer, with `division:id,name`
     * @return array<string, mixed>
     */
    public function for(User $viewer, Collection $people, CarbonImmutable $monday, CarbonImmutable $now): array
    {
        $today = Period::officeDate($now)->toDateString();
        $sunday = $monday->addDays(6);
        $dates = [];

        for ($day = $monday; $day->lte($sunday); $day = $day->addDay()) {
            $dates[] = $day->toDateString();
        }

        $ids = array_values(array_map('strval', $people->modelKeys()));
        $schedules = $this->schedules->forRange($people, $monday, $sunday);
        $reports = DailyReport::query()
            ->where('company_id', $viewer->company_id)
            ->whereIn('user_id', $ids)
            ->where('report_date', '>=', $dates[0])
            ->where('report_date', '<=', $dates[6])
            ->get(['id', 'user_id', 'report_date', 'submitted_at']);
        $aggregates = DB::table('daily_report_items')
            ->whereIn('daily_report_id', $reports->modelKeys())
            ->groupBy('daily_report_id')
            ->select('daily_report_id')
            ->selectRaw('count(*) as items')
            ->selectRaw('coalesce(sum(hours), 0) as hours')
            ->get()
            ->keyBy('daily_report_id');
        $byUserDay = $reports->keyBy(fn (DailyReport $report): string => $report->user_id.'|'.$report->report_date->toDateString());

        $divisions = [];
        $totals = ['expected' => 0, 'reported' => 0, 'hours' => 0.0, 'people_reported' => 0];

        foreach ($people as $user) {
            $key = $user->division_id ?? 'none';
            $divisions[$key] ??= ['id' => $user->division_id, 'name' => $user->division->name ?? 'Tanpa divisi', 'expected' => 0, 'reported' => 0, 'people' => []];
            $cells = [];
            $row = ['reported_days' => 0, 'scheduled_days' => 0, 'hours' => 0.0];

            foreach ($dates as $date) {
                $report = $byUserDay->get($user->id.'|'.$date);
                $scheduled = ($schedules[$user->id][$date] ?? null)?->isWorkday() ?? false;
                $aggregate = $report !== null ? $aggregates->get($report->id) : null;
                $state = match (true) {
                    $report?->isSubmitted() === true => 'reported',
                    $report !== null => 'draft',
                    $date > $today => 'future',
                    $scheduled => 'missing',
                    default => 'off',
                };

                if ($scheduled && $date <= $today) {
                    $row['scheduled_days']++;
                }

                if ($state === 'reported') {
                    $row['reported_days']++;
                    $row['hours'] += (float) ($aggregate->hours ?? 0);
                }

                $hours = $state === 'reported' ? (float) ($aggregate->hours ?? 0) : 0.0;
                $cells[] = [
                    'date' => $date,
                    'state' => $state,
                    'items' => $state === 'reported' ? (int) ($aggregate->items ?? 0) : 0,
                    'hours' => $hours > 0 ? round($hours, 2) : null,
                    'report_id' => $state === 'reported' ? $report->id : null,
                ];
            }

            $divisions[$key]['expected'] += $row['scheduled_days'];
            $divisions[$key]['reported'] += $row['reported_days'];
            $totals['expected'] += $row['scheduled_days'];
            $totals['reported'] += $row['reported_days'];
            $totals['hours'] += $row['hours'];
            $totals['people_reported'] += $row['reported_days'] > 0 ? 1 : 0;
            $divisions[$key]['people'][] = [
                'user' => ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url],
                'days' => $cells,
                'reported_days' => $row['reported_days'],
                'scheduled_days' => $row['scheduled_days'],
                'hours' => $row['hours'] > 0 ? round($row['hours'], 2) : null,
            ];
        }

        usort($divisions, fn (array $a, array $b): int => [$a['id'] === null, $a['name']] <=> [$b['id'] === null, $b['name']]);
        $totals['hours'] = round($totals['hours'], 2);
        $submitted = $reports->filter(fn (DailyReport $report): bool => $report->isSubmitted())->modelKeys();

        return [
            'week' => [
                'start' => $dates[0],
                'end' => $dates[6],
                'label' => self::label($monday, $sunday),
                'is_current' => $today >= $dates[0] && $today <= $dates[6],
                'previous' => $monday->subWeek()->toDateString(),
                'next' => $dates[6] < $today ? $monday->addWeek()->toDateString() : null,
            ],
            'days' => array_map(fn (string $date, int $index): array => [
                'date' => $date,
                'label' => self::DAY_NAMES[$index].' '.(int) substr($date, 8),
                'is_today' => $date === $today,
                'is_future' => $date > $today,
            ], $dates, array_keys($dates)),
            'totals' => $totals,
            'divisions' => $divisions,
            'top_tasks' => $this->topTasks($viewer, $submitted),
            'blockers' => $this->blockers($submitted, $people),
        ];
    }

    /**
     * Tasks named in the most reports this week (distinct people first).
     *
     * @param  array<int, string>  $reportIds  sent reports of the week
     * @return list<array<string, mixed>>
     */
    private function topTasks(User $viewer, array $reportIds): array
    {
        if ($reportIds === []) {
            return [];
        }

        $rows = DB::table('daily_report_items')
            ->join('daily_reports', 'daily_reports.id', '=', 'daily_report_items.daily_report_id')
            ->whereIn('daily_report_items.daily_report_id', $reportIds)
            ->whereNotNull('daily_report_items.task_id')
            ->groupBy('daily_report_items.task_id')
            ->select('daily_report_items.task_id')
            ->selectRaw('max(daily_report_items.task_key) as task_key')
            ->selectRaw('count(*) as mentions')
            ->selectRaw('count(distinct daily_reports.user_id) as people')
            ->selectRaw('coalesce(sum(daily_report_items.hours), 0) as hours')
            ->selectRaw('(array_agg(daily_report_items.percent order by daily_reports.report_date desc, daily_report_items.updated_at desc) filter (where daily_report_items.percent is not null))[1] as last_percent')
            ->orderByDesc('people')
            ->orderByDesc('mentions')
            ->orderBy('daily_report_items.task_id')
            ->limit(self::TOP_TASKS * 3)
            ->get();

        $tasks = ReportTasks::for($viewer, $rows->pluck('task_id'));
        $result = [];

        foreach ($rows as $row) {
            $task = $tasks->task($row->task_id);

            if ($task === null) {
                continue;
            }

            $result[] = [
                'task_id' => $row->task_id,
                'key' => $row->task_key,
                'title' => $task['title'],
                'url' => $task['url'],
                'workspace' => $task['workspace'],
                'mentions' => (int) $row->mentions,
                'people' => (int) $row->people,
                'hours' => (float) $row->hours > 0 ? round((float) $row->hours, 2) : null,
                'last_percent' => $row->last_percent !== null ? (int) $row->last_percent : null,
            ];

            if (count($result) === self::TOP_TASKS) {
                break;
            }
        }

        return $result;
    }

    /**
     * Blockers written in this week's sent reports, latest first.
     *
     * @param  array<int, string>  $reportIds
     * @param  Collection<int, User>  $people
     * @return list<array<string, mixed>>
     */
    private function blockers(array $reportIds, Collection $people): array
    {
        if ($reportIds === []) {
            return [];
        }

        $users = $people->keyBy('id');

        return array_values(DailyReport::query()
            ->whereIn('id', $reportIds)
            ->whereNotNull('blockers')
            ->whereRaw("btrim(blockers) <> ''")
            ->orderByDesc('report_date')
            ->orderByDesc('submitted_at')
            ->limit(self::BLOCKERS)
            ->get(['id', 'user_id', 'report_date', 'blockers', 'submitted_at'])
            ->map(fn (DailyReport $report): array => [
                'report_id' => $report->id,
                'date' => $report->report_date->toDateString(),
                'user' => [
                    'id' => $report->user_id,
                    'name' => $users->get($report->user_id)->name ?? 'Karyawan',
                    'avatar' => $users->get($report->user_id)?->avatar_url,
                    'division' => $users->get($report->user_id)?->division?->name,
                ],
                'text' => (string) $report->blockers,
            ])
            ->all());
    }

    /** "5–11 Okt 2026", "29 Sep – 5 Okt 2026", "29 Des 2025 – 4 Jan 2026". */
    public static function label(CarbonImmutable $monday, CarbonImmutable $sunday): string
    {
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $end = $sunday->day.' '.$months[$sunday->month - 1].' '.$sunday->year;

        if ($monday->year !== $sunday->year) {
            return $monday->day.' '.$months[$monday->month - 1].' '.$monday->year.' – '.$end;
        }

        return $monday->month === $sunday->month
            ? $monday->day.'–'.$end
            : $monday->day.' '.$months[$monday->month - 1].' – '.$end;
    }
}
