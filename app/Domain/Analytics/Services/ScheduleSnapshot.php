<?php

namespace App\Domain\Analytics\Services;

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Bulk version of ScheduleResolver::forDate() for dashboards: which shift
 * applies to each employee on one date, in three queries for any number of
 * people. Same precedence: date override → company holiday → weekly pattern
 * (latest valid_from) → unscheduled. Kept equivalent by ScheduleSnapshotTest.
 */
final class ScheduleSnapshot
{
    /**
     * @param  iterable<User>  $users
     * @return array<string, Shift|null> user id → shift when it is a work day, null otherwise
     */
    public function workShifts(iterable $users, CarbonImmutable $date): array
    {
        $workDate = ScheduleResolver::officeDate($date);
        $day = $workDate->toDateString();
        $ids = [];
        $companies = [];

        foreach ($users as $user) {
            $ids[] = $user->id;
            $companies[$user->id] = $user->company_id;
        }

        if ($ids === []) {
            return [];
        }

        $holidays = Holiday::query()
            ->whereIn('company_id', array_unique(array_values($companies)))
            ->whereDate('date', $day)
            ->pluck('company_id')
            ->flip();

        $overrides = ShiftAssignment::query()
            ->with('shift')
            ->whereIn('user_id', $ids)
            ->whereDate('override_date', $day)
            ->get()
            ->keyBy('user_id');

        $patterns = ShiftAssignment::query()
            ->with('shift')
            ->whereIn('user_id', $ids)
            ->patternsActiveOn($workDate)
            ->whereRaw('? = ANY(weekdays)', [$workDate->dayOfWeekIso])
            ->orderByDesc('valid_from')
            ->orderByDesc('created_at')
            ->get()
            ->unique('user_id')
            ->keyBy('user_id');

        $result = [];

        foreach ($ids as $id) {
            $override = $overrides->get($id);

            if ($override !== null) {
                $result[$id] = $override->shift;

                continue;
            }

            $result[$id] = $holidays->has($companies[$id]) ? null : $patterns->get($id)?->shift;
        }

        return $result;
    }
}
