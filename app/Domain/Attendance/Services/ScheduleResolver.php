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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

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
     * Schedules of many employees over a date range with three queries (monthly
     * recap, today's board). Same precedence as forDate(): date override →
     * company holiday → latest active weekly pattern → unscheduled.
     *
     * @param  iterable<User>  $users
     * @return array<string, array<string, DaySchedule>> user id => [Y-m-d => schedule]
     */
    public function forRange(iterable $users, CarbonInterface $from, CarbonInterface $to): array
    {
        $users = collect($users);
        $first = self::officeDate($from);
        $last = self::officeDate($to);

        if ($users->isEmpty() || $first->gt($last)) {
            return [];
        }

        $firstDay = $first->toDateString();
        $lastDay = $last->toDateString();

        /** @var Collection<string, Collection<int, ShiftAssignment>> $assignments */
        $assignments = ShiftAssignment::query()
            ->with('shift')
            ->whereIn('user_id', $users->pluck('id'))
            ->where(function (Builder $query) use ($firstDay, $lastDay): void {
                $query->whereBetween('override_date', [$firstDay, $lastDay])
                    ->orWhere(function (Builder $pattern) use ($firstDay, $lastDay): void {
                        $pattern->whereNull('override_date')
                            ->where('valid_from', '<=', $lastDay)
                            ->where(fn (Builder $until) => $until->whereNull('valid_until')->orWhere('valid_until', '>=', $firstDay));
                    });
            })
            ->orderByDesc('valid_from')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('user_id');

        $holidays = Holiday::query()
            ->whereIn('company_id', $users->pluck('company_id')->unique())
            ->whereBetween('date', [$firstDay, $lastDay])
            ->get()
            ->keyBy(fn (Holiday $holiday): string => $holiday->company_id.'|'.$holiday->date->toDateString());

        $result = [];

        foreach ($users as $user) {
            /** @var Collection<int, ShiftAssignment> $own */
            $own = $assignments->get($user->id, collect());
            $overrides = $own->filter(fn (ShiftAssignment $a): bool => $a->override_date !== null)
                ->keyBy(fn (ShiftAssignment $a): string => $a->override_date?->toDateString() ?? '');
            $patterns = $own->filter(fn (ShiftAssignment $a): bool => $a->override_date === null);

            for ($date = $first; $date->lte($last); $date = $date->addDay()) {
                $day = $date->toDateString();
                $holiday = $holidays->get($user->company_id.'|'.$day);
                $override = $overrides->get($day);

                if ($override !== null) {
                    $result[$user->id][$day] = $this->schedule($date, $override->shift, $override->work_mode_override ?? $user->work_mode, $holiday, isOverride: true, workday: $override->shift !== null);

                    continue;
                }

                $pattern = $patterns->first(fn (ShiftAssignment $a): bool => $a->valid_from->toDateString() <= $day
                    && ($a->valid_until === null || $a->valid_until->toDateString() >= $day)
                    && in_array($date->dayOfWeekIso, $a->weekdays, true));

                $result[$user->id][$day] = $this->schedule($date, $pattern?->shift, $pattern->work_mode_override ?? $user->work_mode, $holiday, isOverride: false, workday: $pattern?->shift !== null && $holiday === null);
            }
        }

        return $result;
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
