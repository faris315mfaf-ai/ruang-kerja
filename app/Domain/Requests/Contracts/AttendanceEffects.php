<?php

namespace App\Domain\Requests\Contracts;

use App\Domain\Requests\Data\AttendanceRevertPlan;
use App\Models\EmployeeRequest;
use Illuminate\Validation\ValidationException;

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
     * What revert() would change, without changing anything.
     */
    public function revertPlan(EmployeeRequest $request): AttendanceRevertPlan;

    /**
     * Undo what apply* wrote for this request (an approved request voided by
     * HR). Call after the request left the approved status (overtime is
     * recalculated from approved requests).
     *
     * @throws ValidationException when the plan is blocked
     */
    public function revert(EmployeeRequest $request): AttendanceRevertPlan;
}
