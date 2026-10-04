<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Models\EmployeeRequest;

/**
 * No-op binding used until attendance_days exists.
 */
final class NullAttendanceEffects implements AttendanceEffects
{
    public function applyAbsence(EmployeeRequest $request, array $workDates): void {}

    public function applyOvertime(EmployeeRequest $request): void {}

    public function applyCorrection(EmployeeRequest $request): void {}

    public function revert(EmployeeRequest $request): void {}
}
