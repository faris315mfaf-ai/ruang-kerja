<?php

namespace App\Domain\Requests\Contracts;

use App\Models\EmployeeRequest;

/**
 * Side effects of an approved request on attendance (ARCHITECTURE §3.4).
 * Called inside the approval transaction. Default binding is a no-op until the
 * attendance module (attendance_days) is available.
 */
interface AttendanceEffects
{
    /**
     * Whole-day leave / permit / sick / business trip: mark each working date
     * with the category's status and link the request.
     *
     * @param  list<string>  $workDates  office dates (Y-m-d)
     */
    public function applyAbsence(EmployeeRequest $request, array $workDates): void;

    /**
     * Approved overtime: add the minutes to the work date's overtime_minutes.
     */
    public function applyOvertime(EmployeeRequest $request): void;

    /**
     * Approved attendance correction: apply the requested check-in/out times.
     */
    public function applyCorrection(EmployeeRequest $request): void;

    /**
     * Undo what apply* wrote for this request (e.g. an approved request voided by HR).
     */
    public function revert(EmployeeRequest $request): void;
}
