<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\LocationVerifier;
use App\Domain\Attendance\Services\OpenDayLocator;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\OfficeClock;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * The signed-in employee's own attendance: today's state (which action is
 * next), allowed locations, the last 30 days and the compact shell status.
 */
final class MyAttendance
{
    public const int HISTORY_DAYS = 30;

    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly OpenDayLocator $openDays,
        private readonly LocationVerifier $locations,
        private readonly AttendancePresenter $presenter,
    ) {}

    /**
     * @return array{action: 'check_in'|'check_out'|'done'|'unavailable', schedule: DaySchedule, day: AttendanceDay|null}
     */
    public function current(User $user, CarbonImmutable $now): array
    {
        $days = $this->openDays->find($user, $now);

        if ($days->open !== null) {
            // OpenDayLocator loads yesterday and today together; strict mode forbids lazy loading their logs.
            $days->open->loadMissing(['checkInLog.officeLocation', 'checkOutLog.officeLocation']);
            $schedule = $this->schedules->forDate($user, ScheduleResolver::parseDate($days->open->work_date->toDateString()));

            if ($days->open->status === AttendanceStatus::BusinessTrip) {
                $schedule = $schedule->asBusinessTrip();
            }

            return ['action' => 'check_out', 'schedule' => $schedule, 'day' => $days->open];
        }

        $candidates = $this->schedules->checkInCandidates($user, $now);
        $rows = AttendanceDay::query()
            ->with(['shift', 'checkInLog.officeLocation', 'checkOutLog.officeLocation'])
            ->where('user_id', $user->id)
            ->whereIn('work_date', array_map(fn (DaySchedule $schedule): string => $schedule->workDateString(), $candidates))
            ->get()
            ->keyBy(fn (AttendanceDay $day): string => $day->work_date->toDateString());

        foreach ($candidates as $candidate) {
            $day = $rows->get($candidate->workDateString());

            if ($day === null || $day->check_in_at === null) {
                $action = $day !== null && $day->blocksCheckIn() ? 'unavailable' : 'check_in';
                $schedule = $day?->status === AttendanceStatus::BusinessTrip ? $candidate->asBusinessTrip() : $candidate;

                return ['action' => $action, 'schedule' => $schedule, 'day' => $day];
            }
        }

        $today = $candidates[count($candidates) - 1];

        return ['action' => 'done', 'schedule' => $today, 'day' => $rows->get($today->workDateString())];
    }

    /**
     * Props of the Absensi page (history is deferred by the controller).
     *
     * @return array<string, mixed>
     */
    public function today(User $user, CarbonImmutable $now): array
    {
        ['action' => $action, 'schedule' => $schedule, 'day' => $day] = $this->current($user, $now);
        $day?->loadMissing(['shift', 'checkInLog.officeLocation', 'checkOutLog.officeLocation']);

        return [
            'action' => $action,
            'schedule' => $this->presenter->schedule($schedule),
            'day' => $day === null ? null : $this->presenter->day($day, withSelfies: true),
            'locations' => $this->locations->allowedLocations($user, $schedule)
                ->map(fn ($location): array => $this->presenter->location($location))
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function history(User $user, CarbonImmutable $now): array
    {
        $from = ScheduleResolver::officeDate($now)->subDays(self::HISTORY_DAYS - 1)->toDateString();

        return AttendanceDay::query()
            ->with(['shift', 'checkInLog.officeLocation', 'checkOutLog.officeLocation'])
            ->where('user_id', $user->id)
            ->whereDate('work_date', '>=', $from)
            ->orderByDesc('work_date')
            ->get()
            ->map(fn (AttendanceDay $day): array => $this->presenter->day($day))
            ->values()
            ->all();
    }

    /**
     * Compact status for the sidebar widget and topbar button.
     *
     * @return array<string, mixed>
     */
    public function status(User $user, CarbonImmutable $now): array
    {
        ['action' => $action, 'schedule' => $schedule, 'day' => $day] = $this->current($user, $now);
        $location = $day?->checkInLog?->officeLocation?->name;

        return [
            'action' => $action,
            'status' => $day?->status->value,
            'statusLabel' => $day?->status->label(),
            'checkInAt' => AttendancePresenter::iso($day?->check_in_at),
            'checkOutAt' => AttendancePresenter::iso($day?->check_out_at),
            'lateMinutes' => $day->late_minutes ?? 0,
            'locationName' => $location,
            'isRemote' => $day?->checkInLog?->method->value === 'wfh',
            'shiftName' => $schedule->isWorkday() ? $schedule->shift?->name : null,
            'start' => AttendancePresenter::iso($schedule->scheduledStart),
            'startLabel' => $schedule->scheduledStart === null ? null : OfficeClock::time($schedule->scheduledStart),
            'end' => AttendancePresenter::iso($schedule->scheduledEnd),
            'endLabel' => $schedule->scheduledEnd === null ? null : OfficeClock::time($schedule->scheduledEnd),
            'distanceM' => $day?->checkInLog?->distance_m === null ? null : (int) round($day->checkInLog->distance_m),
            'isHoliday' => $schedule->isHoliday(),
        ];
    }
}
