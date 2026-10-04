<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Sets the schedule of one employee for one date: another shift, a day off
 * (no shift) or another work mode (e.g. a WFH day). One override per date.
 */
final class SaveShiftOverride
{
    public function handle(User $employee, CarbonImmutable $date, ?Shift $shift, ?WorkMode $workModeOverride = null): ShiftAssignment
    {
        $day = $date->toDateString();

        $override = ShiftAssignment::query()
            ->where('user_id', $employee->id)
            ->whereDate('override_date', $day)
            ->first() ?? new ShiftAssignment(['user_id' => $employee->id]);

        $override->fill([
            'shift_id' => $shift?->id,
            'weekdays' => [],
            'valid_from' => $day,
            'valid_until' => $day,
            'override_date' => $day,
            'work_mode_override' => $workModeOverride,
        ]);
        $override->save();

        return $override;
    }
}
