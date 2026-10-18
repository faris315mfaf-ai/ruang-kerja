<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\CloseDayReport;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Notifications\MissingCheckOutNotification;
use App\Domain\Attendance\Services\OpenDayLocator;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Requests\Services\ApprovedOvertime;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Closes one work date (docs/ARCHITECTURE.md §3.3), idempotent:
 *
 * - scheduled, no check-in, no approved request → `absent`;
 * - checked in without check-out → `needs_correction` + notification (once);
 * - pattern day falling on a holiday → `holiday`;
 * - system rows that no longer match the schedule are corrected or removed.
 *
 * A day is only closed once its check-out window (scheduled end + grace) has
 * passed, so overnight shifts are closed by the next run.
 */
final class CloseAttendanceDay
{
    /**
     * Statuses this command writes on days without a check-in.
     */
    private const array SYSTEM_STATUSES = [AttendanceStatus::Absent, AttendanceStatus::Holiday];

    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly ApprovedOvertime $overtime,
    ) {}

    public function handle(CarbonImmutable $workDate, ?CarbonImmutable $now = null): CloseDayReport
    {
        $now ??= CarbonImmutable::now();
        $date = ScheduleResolver::officeDate($workDate);
        $report = new CloseDayReport($date->toDateString());

        User::query()
            ->active()
            // Scheduled per company (CompanySchedule): only the current company's people.
            ->when(CurrentCompany::id(), fn ($query, string $company) => $query->where('company_id', $company))
            ->where(fn ($query) => $query->whereNull('joined_at')->orWhereDate('joined_at', '<=', $date->toDateString()))
            ->orderBy('id')
            ->each(function (User $user) use ($date, $now, $report): void {
                $this->closeFor($user, $date, $now, $report);
            });

        return $report;
    }

    /**
     * Closes one employee's work date again (e.g. after HR canceled an approved
     * leave of a past date, CancelApprovedRequest). Same rules as handle().
     */
    public function handleFor(User $user, CarbonImmutable $workDate, ?CarbonImmutable $now = null): CloseDayReport
    {
        $now ??= CarbonImmutable::now();
        $date = ScheduleResolver::officeDate($workDate);
        $report = new CloseDayReport($date->toDateString());

        if ($user->status === UserStatus::Active && ($user->joined_at === null || $user->joined_at->toDateString() <= $date->toDateString())) {
            $this->closeFor($user, $date, $now, $report);
        }

        return $report;
    }

    private function closeFor(User $user, CarbonImmutable $date, CarbonImmutable $now, CloseDayReport $report): void
    {
        $day = AttendanceDay::query()
            ->where('user_id', $user->id)
            ->whereDate('work_date', $date->toDateString())
            ->first();

        // Overtime minutes come from approved overtime requests (Sprint 4).
        if ($day !== null) {
            $day->overtime_minutes = $this->overtime->minutesFor($user->id, $date->toDateString());

            if ($day->isDirty('overtime_minutes')) {
                $day->save();
            }
        }

        // Leave, permit, sick, business trip come from approved requests (Sprint 4).
        if ($day !== null && ($day->request_id !== null || $day->status->comesFromRequest())) {
            return;
        }

        if ($day !== null && $day->check_in_at !== null) {
            $this->closeCheckedInDay($user, $day, $now, $report);

            return;
        }

        $schedule = $this->schedules->forDate($user, $date);

        if ($schedule->isWorkday()) {
            if ($schedule->scheduledEnd !== null && $now->lt($this->closableAt($schedule->scheduledEnd))) {
                $report->deferred++;

                return;
            }

            if ($this->writeSystemDay($user, $day, $schedule, AttendanceStatus::Absent)) {
                $report->absent++;
            }

            return;
        }

        if ($schedule->isHoliday() && $schedule->shift !== null) {
            if ($this->writeSystemDay($user, $day, $schedule, AttendanceStatus::Holiday)) {
                $report->holiday++;
            }

            return;
        }

        // Not scheduled (any more): drop a row this command wrote earlier.
        if ($day !== null && in_array($day->status, self::SYSTEM_STATUSES, true) && $day->overtime_minutes === 0) {
            $day->delete();
            $report->removed++;
        }
    }

    private function closeCheckedInDay(User $user, AttendanceDay $day, CarbonImmutable $now, CloseDayReport $report): void
    {
        if ($day->check_out_at !== null || $day->status === AttendanceStatus::NeedsCorrection) {
            return;
        }

        if ($now->lt(OpenDayLocator::closesAt($day))) {
            $report->deferred++;

            return;
        }

        $day->status = AttendanceStatus::NeedsCorrection;
        $day->save();
        $report->needsCorrection++;

        $user->notify(new MissingCheckOutNotification($day));
    }

    /**
     * Creates or corrects a system row; false when nothing changed.
     */
    private function writeSystemDay(User $user, ?AttendanceDay $day, DaySchedule $schedule, AttendanceStatus $status): bool
    {
        if ($day !== null && ! in_array($day->status, self::SYSTEM_STATUSES, true)) {
            return false;
        }

        $day ??= new AttendanceDay(['user_id' => $user->id, 'work_date' => $schedule->workDateString()]);
        $workday = $schedule->isWorkday();

        $day->fill([
            'status' => $status,
            'shift_id' => $workday ? $schedule->shift?->id : null,
            'scheduled_start' => $schedule->scheduledStart,
            'scheduled_end' => $schedule->scheduledEnd,
        ]);

        if ($day->exists && ! $day->isDirty()) {
            return false;
        }

        DB::transaction(fn () => $day->save());

        return true;
    }

    private function closableAt(CarbonImmutable $scheduledEnd): CarbonImmutable
    {
        return $scheduledEnd->addMinutes(config()->integer('attendance.schedule.checkout_grace_minutes'));
    }
}
