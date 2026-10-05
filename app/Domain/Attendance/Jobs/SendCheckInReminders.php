<?php

namespace App\Domain\Attendance\Jobs;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Notifications\CheckInReminderNotification;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

/**
 * Scheduled every 5 minutes: reminds employees who have not checked in
 * `attendance.reminder.delay_minutes` after their scheduled start, at most
 * once per work date.
 */
final class SendCheckInReminders implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 240;

    public function handle(ScheduleResolver $schedules): void
    {
        $now = CarbonImmutable::now();
        $delay = config()->integer('attendance.reminder.delay_minutes');

        User::query()
            ->active()
            ->whereIn('id', ShiftAssignment::query()->select('user_id'))
            ->orderBy('id')
            ->each(function (User $user) use ($schedules, $now, $delay): void {
                foreach ($schedules->checkInCandidates($user, $now) as $schedule) {
                    if (! $schedule->isWorkday() || $schedule->scheduledStart === null || $schedule->scheduledEnd === null) {
                        continue;
                    }

                    $remindAt = $schedule->scheduledStart->addMinutes($delay);

                    if ($now->lt($remindAt) || $now->gte($schedule->scheduledEnd)) {
                        continue;
                    }

                    $day = AttendanceDay::query()
                        ->where('user_id', $user->id)
                        ->whereDate('work_date', $schedule->workDateString())
                        ->first();

                    if ($day !== null && ($day->check_in_at !== null || $day->status->comesFromRequest() || $day->request_id !== null)) {
                        continue;
                    }

                    // Once per user and work date, even when runs overlap.
                    $key = "attendance:check-in-reminder:{$user->id}:{$schedule->workDateString()}";

                    if (! Cache::add($key, true, now()->addDays(2))) {
                        continue;
                    }

                    $user->notify(new CheckInReminderNotification(
                        $schedule->workDateString(),
                        $schedule->shift->name ?? 'Anda',
                        $schedule->scheduledStart,
                    ));
                }
            });
    }
}
