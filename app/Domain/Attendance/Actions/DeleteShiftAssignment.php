<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\ShiftAssignment;

/**
 * Removes a pattern or a date override. Past attendance keeps its own
 * schedule snapshot (attendance_days.shift_id / scheduled_*).
 */
final class DeleteShiftAssignment
{
    public function handle(ShiftAssignment $assignment): void
    {
        $assignment->delete();
    }
}
