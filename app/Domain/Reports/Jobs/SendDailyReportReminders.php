<?php

namespace App\Domain\Reports\Jobs;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Reports\Notifications\DailyReportReminder;
use App\Domain\Reports\Support\ReportDay;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\DailyReport;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;

/**
 * 16.30 office time on weekdays (routes/console.php): reminds every active
 * employee who is scheduled to work today (shift pattern/override, not a
 * holiday, not on approved leave without a check-in) and has not sent
 * today's daily report. Once per person and date (notification_dispatch_logs,
 * subject = the user, cycle = the date), even when runs overlap.
 */
final class SendDailyReportReminders implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $uniqueFor = 3600;

    public function handle(ScheduleResolver $schedules, NotificationDispatchLog $log): void
    {
        $now = CarbonImmutable::now();
        $today = ReportDay::today($now);
        $date = CarbonImmutable::parse($today, config()->string('app.office_timezone'));

        User::query()
            ->active()
            ->whereNotIn('id', DailyReport::query()->whereDate('report_date', $today)->whereNotNull('submitted_at')->select('user_id'))
            ->orderBy('id')
            ->chunk(200, function (Collection $users) use ($schedules, $log, $date, $today): void {
                $plans = $schedules->forRange($users, $date, $date);
                $away = AttendanceDay::query()
                    ->whereIn('user_id', $users->modelKeys())
                    ->whereDate('work_date', $today)
                    ->whereNotNull('request_id')
                    ->whereNull('check_in_at')
                    ->pluck('user_id')
                    ->flip();

                foreach ($users as $user) {
                    $schedule = $plans[$user->id][$today] ?? null;

                    if ($schedule === null || ! $schedule->isWorkday() || $away->has($user->id)) {
                        continue;
                    }

                    if ($log->claim($user, NotificationType::ReportReminder, $user, $today)) {
                        $user->notify(new DailyReportReminder($today));
                    }
                }
            });
    }
}
