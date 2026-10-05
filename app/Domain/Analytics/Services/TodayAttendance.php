<?php

namespace App\Domain\Analytics\Services;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * "Kehadiran hari ini" for a set of people: who is scheduled, present, late,
 * away (cuti/izin/sakit/dinas), not checked in yet or absent — straight from
 * attendance_days + the schedule (no dependency on the Sprint 3 recap).
 *
 * A person is listed when today is a work day for them, or when they have an
 * attendance row today that is not a holiday (e.g. a check-in without shift).
 */
final class TodayAttendance
{
    public const array STATES = ['present', 'late', 'away', 'not_checked_in', 'absent'];

    public function __construct(private readonly ScheduleSnapshot $schedules) {}

    /**
     * @param  Collection<int, User>  $users  with `division` loaded
     * @return array{
     *     date: string,
     *     counts: array{scheduled: int, present: int, late: int, away: int, not_checked_in: int, absent: int, leave: int, permit: int, sick: int, business_trip: int},
     *     shifts: list<array{name: string, count: int}>,
     *     people: list<array<string, mixed>>
     * }
     */
    public function for(Collection $users, CarbonImmutable $now): array
    {
        $date = ScheduleResolver::officeDate($now);
        $shifts = $this->schedules->workShifts($users, $date);
        $days = AttendanceDay::query()
            ->whereIn('user_id', $users->modelKeys())
            ->whereDate('work_date', $date->toDateString())
            ->get()
            ->keyBy('user_id');
        $requestTypes = $this->requestTypeNames($days);

        $counts = ['scheduled' => 0, 'present' => 0, 'late' => 0, 'away' => 0, 'not_checked_in' => 0, 'absent' => 0, 'leave' => 0, 'permit' => 0, 'sick' => 0, 'business_trip' => 0];
        $byShift = [];
        $people = [];

        foreach ($users as $user) {
            $shift = $shifts[$user->id] ?? null;
            $day = $days->get($user->id);

            if ($shift === null && ($day === null || $day->status === AttendanceStatus::Holiday)) {
                continue;
            }

            $state = $this->state($day);
            $counts['scheduled']++;
            $counts[$state]++;

            if ($state === 'late') {
                $counts['present']++; // "Hadir" includes the late ones (mockup DashboardHR)
            }

            match ($state === 'away' ? $day?->status : null) {
                AttendanceStatus::Leave => $counts['leave']++,
                AttendanceStatus::Permit => $counts['permit']++,
                AttendanceStatus::Sick => $counts['sick']++,
                AttendanceStatus::BusinessTrip => $counts['business_trip']++,
                default => null,
            };

            $shiftName = $shift->name ?? 'Tanpa shift';
            $byShift[$shiftName] = ($byShift[$shiftName] ?? 0) + 1;

            $people[] = [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => $user->avatar_url,
                    'division_id' => $user->division_id,
                    'division' => $user->division?->name,
                ],
                'state' => $state,
                'status' => $day?->status->value,
                'status_label' => $day?->status->label(),
                'late_minutes' => $day->late_minutes ?? 0,
                'check_in_at' => $day?->check_in_at?->toIso8601String(),
                'request_type' => $day?->request_id !== null ? ($requestTypes[$day->request_id] ?? null) : null,
                'is_suspicious' => $day->is_suspicious ?? false,
            ];
        }

        $order = array_flip(['late', 'away', 'absent', 'not_checked_in', 'present']);
        usort($people, fn (array $a, array $b): int => [$order[$a['state']], $a['check_in_at'] ?? '', $a['user']['name']]
            <=> [$order[$b['state']], $b['check_in_at'] ?? '', $b['user']['name']]);

        arsort($byShift);

        return [
            'date' => $date->toDateString(),
            'counts' => $counts,
            'shifts' => array_map(fn (string $name, int $count): array => ['name' => $name, 'count' => $count], array_keys($byShift), array_values($byShift)),
            'people' => $people,
        ];
    }

    /**
     * present (on time, WFH, early leave, needs correction, checked in on a
     * half-day request or business trip), late, away,
     * absent (alpha) or not checked in yet.
     *
     * @return 'present'|'late'|'away'|'not_checked_in'|'absent'
     */
    private function state(?AttendanceDay $day): string
    {
        if ($day === null) {
            return 'not_checked_in';
        }

        // A full-day request, or a half day / business trip without a check-in
        // yet, is "away"; with a check-in it counts as present (as TodayBoard).
        if ($day->status->comesFromRequest()) {
            return $day->check_in_at === null ? 'away' : 'present';
        }

        if ($day->status === AttendanceStatus::Absent) {
            return 'absent';
        }

        if ($day->check_in_at === null) {
            return 'not_checked_in';
        }

        return $day->status === AttendanceStatus::Late ? 'late' : 'present';
    }

    /**
     * @param  Collection<array-key, AttendanceDay>  $days
     * @return array<string, string> request id → leave type name ("Cuti tahunan")
     */
    private function requestTypeNames(Collection $days): array
    {
        $ids = $days->pluck('request_id')->filter()->unique()->values()->all();

        if ($ids === []) {
            return [];
        }

        return EmployeeRequest::query()
            ->with('leaveType:id,name')
            ->whereIn('id', $ids)
            ->get(['id', 'leave_type_id'])
            ->mapWithKeys(fn (EmployeeRequest $request): array => [$request->id => $request->leaveType->name])
            ->all();
    }
}
