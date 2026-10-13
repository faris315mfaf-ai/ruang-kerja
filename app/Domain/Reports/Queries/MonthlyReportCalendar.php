<?php

namespace App\Domain\Reports\Queries;

use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Reports\Support\ReportDay;
use App\Models\DailyReport;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * One month of the signed-in employee's own daily reports (Riwayat laporan of
 * the Android app): every date that was a scheduled work day (ScheduleResolver)
 * or has a report, newest first, with submitted / draft / missing. Days before
 * joining and after today are left out. Two queries plus the schedule lookup.
 */
final class MonthlyReportCalendar
{
    public function __construct(private readonly ScheduleResolver $schedules) {}

    /**
     * @param  string  $month  "Y-m"
     * @return array{bulan: string, today: string, bulan_sebelumnya: string, bulan_berikutnya: string|null, counts: array{scheduled: int, submitted: int, draft: int, missing: int}, days: list<array<string, mixed>>}
     */
    public function for(User $user, string $month, ?CarbonImmutable $now = null): array
    {
        $today = ReportDay::today($now);
        $first = ScheduleResolver::parseDate($month.'-01');
        $last = $first->endOfMonth()->startOfDay();
        $todayDate = ScheduleResolver::parseDate($today);
        $to = $last->lt($todayDate) ? $last : $todayDate;
        $from = $first;

        if ($user->joined_at !== null) {
            $joined = ScheduleResolver::parseDate($user->joined_at->toDateString());
            $from = $joined->gt($from) ? $joined : $from;
        }

        $counts = ['scheduled' => 0, 'submitted' => 0, 'draft' => 0, 'missing' => 0];
        $days = [];

        if ($from->lte($to)) {
            $reports = DailyReport::query()
                ->where('user_id', $user->id)
                ->whereDate('report_date', '>=', $from->toDateString())
                ->whereDate('report_date', '<=', $to->toDateString())
                ->withCount('items')
                ->withSum('items as hours_total', 'hours')
                ->get()
                ->keyBy(fn (DailyReport $report): string => $report->report_date->toDateString());

            $schedules = $this->schedules->forRange([$user], $from, $to)[$user->id] ?? [];

            for ($day = $to; $day->gte($from); $day = $day->subDay()) {
                $date = $day->toDateString();
                $schedule = $schedules[$date] ?? null;
                $scheduled = $schedule?->isWorkday() ?? false;
                $report = $reports->get($date);

                if (! $scheduled && $report === null) {
                    continue;
                }

                $status = $report === null ? 'missing' : ($report->isSubmitted() ? 'submitted' : 'draft');

                if ($scheduled) {
                    $counts['scheduled']++;
                }

                // Today is not over: an unsent today is not counted as missing yet.
                if ($status !== 'missing' || $date !== $today) {
                    $counts[$status]++;
                }

                $hours = (float) ($report?->getAttribute('hours_total') ?? 0);

                $days[] = [
                    'date' => $date,
                    'is_today' => $date === $today,
                    'scheduled' => $scheduled,
                    'holiday' => $schedule?->isHoliday() === true ? $schedule->holiday?->name : null,
                    'status' => $status,
                    'report' => $report === null ? null : [
                        'id' => $report->id,
                        'submitted_at' => $report->submitted_at?->toIso8601String(),
                        'updated_at' => $report->updated_at?->toIso8601String(),
                        'summary' => $report->summary,
                        'has_blockers' => $report->blockers !== null && $report->blockers !== '',
                        'items_count' => (int) $report->getAttribute('items_count'),
                        'hours' => $hours > 0 ? round($hours, 2) : null,
                        'locked' => $date !== $today,
                    ],
                ];
            }
        }

        $currentMonth = substr($today, 0, 7);
        $next = $first->addMonth()->format('Y-m');

        return [
            'bulan' => $first->format('Y-m'),
            'today' => $today,
            'bulan_sebelumnya' => $first->subMonth()->format('Y-m'),
            'bulan_berikutnya' => $next <= $currentMonth ? $next : null,
            'counts' => $counts,
            'days' => $days,
        ];
    }
}
