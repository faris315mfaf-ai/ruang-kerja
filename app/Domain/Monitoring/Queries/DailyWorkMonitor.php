<?php

namespace App\Domain\Monitoring\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Monitoring\Support\ReportTasks;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * Monitoring kerja harian (keputusan pemilik 6 Okt 2026): who reported their
 * work progress on one office date, per division, and the reports
 * themselves (latest first). Read-only view on daily_reports for Direksi
 * (and the team panel of a Kepala Divisi); the report form belongs to the
 * Laporan module.
 *
 * - scheduled: a work day in the person's schedule (ScheduleResolver);
 * - reported: a sent report (`submitted_at`), scheduled or not;
 * - draft: a report not sent yet;
 * - missing: scheduled without any report.
 *
 * Task titles follow ReportTasks (only tasks the viewer may see).
 * Query count does not grow with people or reports.
 */
final class DailyWorkMonitor
{
    /** Reports listed with their items (the rest is counted). */
    public const int REPORT_LIMIT = 60;

    public function __construct(private readonly ScheduleResolver $schedules) {}

    /**
     * @param  Collection<int, User>  $people  active, visible to the viewer, with `division:id,name`
     * @return array<string, mixed>
     */
    public function for(User $viewer, Collection $people, CarbonImmutable $date, CarbonImmutable $now): array
    {
        $day = $date->toDateString();
        $schedules = $this->schedules->forRange($people, $date, $date);
        $reports = DailyReport::query()
            ->where('company_id', $viewer->company_id)
            ->whereIn('user_id', $people->modelKeys())
            ->whereDate('report_date', $day)
            ->get()
            ->keyBy('user_id');

        $divisions = [];
        $missing = [];
        $totals = ['people' => $people->count(), 'scheduled' => 0, 'reported' => 0, 'draft' => 0, 'missing' => 0];

        foreach ($people as $user) {
            $key = $user->division_id ?? 'none';
            $divisions[$key] ??= ['id' => $user->division_id, 'name' => $user->division->name ?? 'Tanpa divisi', 'people' => 0, 'scheduled' => 0, 'reported' => 0, 'draft' => 0, 'missing' => 0];
            $divisions[$key]['people']++;
            $report = $reports->get($user->id);
            $scheduled = ($schedules[$user->id][$day] ?? null)?->isWorkday() ?? false;
            $state = match (true) {
                $report?->isSubmitted() === true => 'reported',
                $report !== null => 'draft',
                $scheduled => 'missing',
                default => null,
            };

            if ($scheduled) {
                $divisions[$key]['scheduled']++;
                $totals['scheduled']++;
            }

            if ($state !== null) {
                $divisions[$key][$state]++;
                $totals[$state]++;
            }

            if ($scheduled && $state !== 'reported') {
                $missing[] = [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => $user->avatar_url,
                    'division' => $user->division?->name,
                    'draft' => $state === 'draft',
                ];
            }
        }

        usort($divisions, fn (array $a, array $b): int => [$a['id'] === null, $a['name']] <=> [$b['id'] === null, $b['name']]);

        $sent = $reports->filter(fn (DailyReport $report): bool => $report->isSubmitted())
            ->sortByDesc(fn (DailyReport $report): string => $report->submitted_at?->toIso8601String() ?? '')
            ->take(self::REPORT_LIMIT)
            ->values();

        $sent->load('items');
        $users = $people->keyBy('id');

        return [
            'date' => $day,
            'is_today' => $day === Period::officeDate($now)->toDateString(),
            'totals' => $totals,
            'divisions' => $divisions,
            'missing' => $missing,
            'reports' => self::present($viewer, $sent, $users),
        ];
    }

    /**
     * Reports with items as the viewer may see them.
     *
     * @param  \Illuminate\Support\Collection<int, DailyReport>  $reports  with `items`
     * @param  \Illuminate\Support\Collection<string, User>  $users  authors with `division`
     * @return list<array<string, mixed>>
     */
    public static function present(User $viewer, \Illuminate\Support\Collection $reports, \Illuminate\Support\Collection $users): array
    {
        $tasks = ReportTasks::for($viewer, $reports->flatMap(fn (DailyReport $report) => $report->items->pluck('task_id')));

        return array_values($reports->map(function (DailyReport $report) use ($tasks, $users): array {
            $author = $users->get($report->user_id);
            $hours = $report->items->sum(fn (DailyReportItem $item): float => (float) ($item->hours ?? 0));

            return [
                'id' => $report->id,
                'date' => $report->report_date->toDateString(),
                'user' => [
                    'id' => $report->user_id,
                    'name' => $author->name ?? 'Karyawan',
                    'avatar' => $author?->avatar_url,
                    'division' => $author?->division?->name,
                ],
                'submitted_at' => $report->submitted_at?->toIso8601String(),
                'summary' => $report->summary,
                'blockers' => filled($report->blockers) ? $report->blockers : null,
                'items_count' => $report->items->count(),
                'hours' => $hours > 0 ? round($hours, 2) : null,
                'items' => $report->items->map(fn (DailyReportItem $item): array => $tasks->item($item))->values()->all(),
            ];
        })->all());
    }
}
