<?php

namespace App\Domain\HrHub\Actions;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Reports\Notifications\DailyReportReminder;
use App\Domain\Reports\Support\ReportDay;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\DailyReport;
use App\Models\User;
use App\Providers\HrHubServiceProvider;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * "Ingatkan" in Ruang HR › Monitoring (keputusan pemilik 20 Okt 2026): HR
 * reminds people who are scheduled to work today and have not sent today's
 * daily report — the chosen ones, or everyone still missing. Same rules as
 * the 16.30 job (SendDailyReportReminders); at most once per person per day
 * (notification_dispatch_logs, cycle `manual:{date}`), independent of the
 * automatic reminder.
 */
final class RemindDailyReport
{
    public const string CYCLE_PREFIX = 'manual:';

    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly NotificationDispatchLog $log,
    ) {}

    /**
     * @param  list<string>|null  $userIds  null = everyone still missing today
     * @return array{sent: int, skipped: int}
     */
    public function handle(User $actor, ?array $userIds = null, ?CarbonImmutable $now = null): array
    {
        if (! HrHubServiceProvider::canView($actor)) {
            throw new AuthorizationException('Hanya HR yang dapat mengirim pengingat laporan.');
        }

        $now ??= CarbonImmutable::now();
        $today = ReportDay::today($now);
        $date = CarbonImmutable::parse($today, CurrentCompany::timezone());

        $users = User::query()
            ->active()
            ->where('company_id', $actor->company_id)
            ->when($userIds !== null, fn ($query) => $query->whereIn('id', $userIds ?? []))
            ->orderBy('id')
            ->get();

        $sent = 0;
        $skipped = 0;

        if ($users->isEmpty()) {
            return ['sent' => 0, 'skipped' => 0];
        }

        $submitted = DailyReport::query()
            ->whereIn('user_id', $users->modelKeys())
            ->whereDate('report_date', $today)
            ->whereNotNull('submitted_at')
            ->pluck('user_id')
            ->flip();
        $plans = $this->schedules->forRange($users, $date, $date);
        $away = AttendanceDay::query()
            ->whereIn('user_id', $users->modelKeys())
            ->whereDate('work_date', $today)
            ->whereNotNull('request_id')
            ->whereNull('check_in_at')
            ->pluck('user_id')
            ->flip();

        foreach ($users as $user) {
            $schedule = $plans[$user->id][$today] ?? null;

            if ($submitted->has($user->id) || $schedule === null || ! $schedule->isWorkday() || $away->has($user->id)) {
                // Explicitly chosen but not due today: counted as skipped.
                $skipped += $userIds !== null ? 1 : 0;

                continue;
            }

            if ($this->log->claim($user, NotificationType::ReportReminder, $user, self::CYCLE_PREFIX.$today)) {
                $user->notify(new DailyReportReminder($today));
                $sent++;
            } else {
                $skipped++;
            }
        }

        return ['sent' => $sent, 'skipped' => $skipped];
    }
}
