<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Answers "which work date, shift and hours apply to this employee?".
 *
 * Resolution per date (docs/DATABASE.md §2, extended): date override → company
 * holiday → weekly pattern active on that date (latest valid_from wins) →
 * unscheduled. A shift crossing midnight belongs to the date it starts on.
 */
final class ScheduleResolver
{
    public function forDate(User $user, CarbonInterface $date): DaySchedule
    {
        $workDate = self::officeDate($date);
        $day = $workDate->toDateString();
        $defaultMode = $user->work_mode;

        $override = ShiftAssignment::query()
            ->with('shift')
            ->where('user_id', $user->id)
            ->whereDate('override_date', $day)
            ->first();

        $holiday = Holiday::query()
            ->where('company_id', $user->company_id)
            ->whereDate('date', $day)
            ->first();

        if ($override !== null) {
            return $this->schedule(
                $workDate,
                $override->shift,
                $override->work_mode_override ?? $defaultMode,
                $holiday,
                isOverride: true,
                workday: $override->shift !== null,
            );
        }

        $pattern = ShiftAssignment::query()
            ->with('shift')
            ->where('user_id', $user->id)
            ->patternsActiveOn($workDate)
            ->whereRaw('? = ANY(weekdays)', [$workDate->dayOfWeekIso])
            ->orderByDesc('valid_from')
            ->orderByDesc('created_at')
            ->first();

        return $this->schedule(
            $workDate,
            $pattern?->shift,
            $pattern->work_mode_override ?? $defaultMode,
            $holiday,
            isOverride: false,
            workday: $pattern?->shift !== null && $holiday === null,
        );
    }

    /**
     * The schedule an instant belongs to: still yesterday while yesterday's
     * overnight shift has not ended, otherwise today (office timezone).
     */
    public function at(User $user, CarbonInterface $instant): DaySchedule
    {
        $today = self::officeDate($instant);
        $yesterday = $this->forDate($user, $today->subDay());

        if ($this->isWithinOvernightShift($yesterday, $instant)) {
            return $yesterday;
        }

        return $this->forDate($user, $today);
    }

    /**
     * Candidate schedules for a check-in at the instant, most specific first:
     * yesterday's overnight shift (while it runs), then today.
     *
     * @return list<DaySchedule>
     */
    public function checkInCandidates(User $user, CarbonInterface $instant): array
    {
        $today = self::officeDate($instant);
        $yesterday = $this->forDate($user, $today->subDay());
        $current = $this->forDate($user, $today);

        return $this->isWithinOvernightShift($yesterday, $instant) ? [$yesterday, $current] : [$current];
    }

    /**
     * Calendar date in the office timezone (midnight, office timezone).
     */
    public static function officeDate(CarbonInterface $value): CarbonImmutable
    {
        return CarbonImmutable::instance($value)
            ->setTimezone(config()->string('app.office_timezone'))
            ->startOfDay();
    }

    /**
     * Interprets a "Y-m-d" string as an office-local date.
     */
    public static function parseDate(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date, config()->string('app.office_timezone'))->startOfDay();
    }

    private function isWithinOvernightShift(DaySchedule $schedule, CarbonInterface $instant): bool
    {
        return $schedule->isWorkday()
            && $schedule->shift?->crosses_midnight === true
            && $schedule->scheduledEnd !== null
            && $instant->lt($schedule->scheduledEnd);
    }

    private function schedule(
        CarbonImmutable $workDate,
        ?Shift $shift,
        WorkMode $workMode,
        ?Holiday $holiday,
        bool $isOverride,
        bool $workday,
    ): DaySchedule {
        $start = $workday && $shift !== null ? $shift->startOn($workDate)->utc() : null;
        $end = $workday && $shift !== null ? $shift->endOn($workDate)->utc() : null;

        return new DaySchedule($workDate, $shift, $start, $end, $workMode, $holiday, $isOverride);
    }
}
