<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Shift;
use App\Models\User;

/**
 * Creates or updates a shift. `crosses_midnight` is derived from the times.
 */
final class SaveShift
{
    /**
     * @param  array{name: string, start_time: string, end_time: string, break_minutes: int, late_tolerance_min: int, early_leave_tolerance_min: int, check_in_window_before_min: int, office_location_id?: string|null}  $attributes
     */
    public function handle(User $actor, array $attributes, ?Shift $shift = null): Shift
    {
        $shift ??= new Shift(['company_id' => $actor->company_id]);
        $start = substr($attributes['start_time'], 0, 5);
        $end = substr($attributes['end_time'], 0, 5);

        $shift->fill([
            'name' => trim($attributes['name']),
            'start_time' => $start,
            'end_time' => $end,
            'crosses_midnight' => Shift::timesCrossMidnight($start, $end),
            'break_minutes' => $attributes['break_minutes'],
            'late_tolerance_min' => $attributes['late_tolerance_min'],
            'early_leave_tolerance_min' => $attributes['early_leave_tolerance_min'],
            'check_in_window_before_min' => $attributes['check_in_window_before_min'],
            'office_location_id' => $attributes['office_location_id'] ?? null,
        ]);
        $shift->save();

        return $shift;
    }
}
