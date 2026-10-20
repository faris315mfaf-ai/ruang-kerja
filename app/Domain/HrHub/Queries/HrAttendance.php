<?php

namespace App\Domain\HrHub\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Analytics\Services\ScheduleSnapshot;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * Ruang HR › Absensi (keputusan pemilik 20 Okt 2026): today's attendance of
 * the company (HrDashboard::today), who has not checked in although their
 * shift has started, yesterday's missing check-outs, and this month's
 * corrections / alpha days. The full boards stay in the Absensi module.
 */
final class HrAttendance
{
    public const int NOT_CHECKED_IN_LIMIT = 50;

    public function __construct(
        private readonly HrDashboard $hr,
        private readonly ScheduleSnapshot $schedules,
    ) {}

    /**
     * @param  Collection<int, User>  $people  active, with `division`
     * @return array<string, mixed>
     */
    public function for(User $viewer, Collection $people, CarbonImmutable $now): array
    {
        $ids = array_values(array_map('strval', $people->modelKeys()));
        $today = $this->hr->today($people, $now);
        $date = Period::officeDate($now);
        $monthStart = $date->startOfMonth()->toDateString();

        $month = AttendanceDay::query()
            ->whereIn('user_id', $ids)
            ->whereDate('work_date', '>=', $monthStart)
            ->whereDate('work_date', '<=', $date->toDateString())
            ->toBase()
            ->selectRaw('COUNT(*) FILTER (WHERE status = ?) AS needs_correction', [AttendanceStatus::NeedsCorrection->value])
            ->selectRaw('COUNT(*) FILTER (WHERE status = ?) AS absent', [AttendanceStatus::Absent->value])
            ->selectRaw('COUNT(*) FILTER (WHERE status = ?) AS late', [AttendanceStatus::Late->value])
            ->first();

        return [
            'date' => $today['date'],
            'counts' => $today['counts'],
            'shifts' => $today['shifts'],
            'divisions' => $today['divisions'],
            'review_count' => AttendanceLog::query()
                ->where('is_suspicious', true)
                ->whereNull('reviewed_at')
                ->where('occurred_at', '>=', $now->subDays(7)->toIso8601String())
                ->whereIn('user_id', $ids)
                ->count(),
            'missing_check_out' => $this->hr->missingCheckOut($viewer, $ids, $now),
            'month' => [
                'from' => $monthStart,
                'needs_correction' => (int) ($month->needs_correction ?? 0),
                'absent' => (int) ($month->absent ?? 0),
                'late' => (int) ($month->late ?? 0),
            ],
            'not_checked_in' => $this->notCheckedIn($people, $today['people'], $now),
        ];
    }

    /**
     * Scheduled people without a check-in whose shift start has passed.
     *
     * @param  Collection<int, User>  $people
     * @param  list<array<string, mixed>>  $rows  TodayAttendance people
     * @return array{count: int, items: list<array<string, mixed>>}
     */
    private function notCheckedIn(Collection $people, array $rows, CarbonImmutable $now): array
    {
        $waiting = array_values(array_filter($rows, fn (array $row): bool => $row['state'] === 'not_checked_in'));

        if ($waiting === []) {
            return ['count' => 0, 'items' => []];
        }

        $date = Period::officeDate($now);
        $shifts = $this->schedules->workShifts($people->whereIn('id', array_map(fn (array $row): string => $row['user']['id'], $waiting)), $date);
        $items = [];

        foreach ($waiting as $row) {
            $shift = $shifts[$row['user']['id']] ?? null;
            $start = $shift?->startOn($date);

            if ($start === null || $start->gt($now)) {
                continue;
            }

            $items[] = [
                'user' => $row['user'],
                'shift' => $shift->name,
                'scheduled_start' => $start->toIso8601String(),
                'minutes_late' => (int) $start->diffInMinutes($now),
            ];
        }

        usort($items, fn (array $a, array $b): int => [$a['scheduled_start'], $a['user']['name']] <=> [$b['scheduled_start'], $b['user']['name']]);

        return ['count' => count($items), 'items' => array_slice($items, 0, self::NOT_CHECKED_IN_LIMIT)];
    }
}
