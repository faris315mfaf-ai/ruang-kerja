<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\OpenDays;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Finds the day a check-out applies to: today's checked-in day, or
 * yesterday's (overnight shift / overtime) while its check-out window is open.
 */
final class OpenDayLocator
{
    public function find(User $user, CarbonImmutable $now): OpenDays
    {
        $today = ScheduleResolver::officeDate($now);

        $days = AttendanceDay::query()
            ->with('shift')
            ->where('user_id', $user->id)
            ->whereDate('work_date', '>=', $today->subDay()->toDateString())
            ->whereDate('work_date', '<=', $today->toDateString())
            ->whereNotNull('check_in_at')
            ->orderByDesc('work_date')
            ->get();

        $open = null;
        $checkedOut = null;

        foreach ($days as $day) {
            $isToday = $day->work_date->toDateString() === $today->toDateString();

            if (! $isToday && $now->gte(self::closesAt($day))) {
                continue;
            }

            if ($day->check_out_at === null) {
                $open ??= $day;
            } else {
                $checkedOut ??= $day;
            }
        }

        return new OpenDays($open, $checkedOut);
    }

    /**
     * Until when a day still accepts its check-out: scheduled end (or the end
     * of the work date when unscheduled) plus the configured grace period.
     */
    public static function closesAt(AttendanceDay $day): CarbonImmutable
    {
        $end = $day->scheduled_end
            ?? ScheduleResolver::parseDate($day->work_date->toDateString())->addDay();

        return $end->addMinutes(config()->integer('attendance.schedule.checkout_grace_minutes'));
    }
}
