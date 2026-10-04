<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;

/**
 * Dispatches an approved request to the attendance side effects by category.
 */
final class ApprovedRequestEffects
{
    public function __construct(
        private readonly AttendanceEffects $attendance,
        private readonly WorkingDayCalculator $calendar,
    ) {}

    public function apply(EmployeeRequest $request): void
    {
        $category = $request->leaveType->category;

        match (true) {
            $category === RequestCategory::Overtime => $this->attendance->applyOvertime($request),
            $category === RequestCategory::Correction => $this->attendance->applyCorrection($request),
            $category === RequestCategory::Permit && ($request->payload['mode'] ?? 'days') === 'hours' => null,
            default => $this->attendance->applyAbsence($request, $this->workDates($request)),
        };
    }

    /**
     * @return list<string>
     */
    public function workDates(EmployeeRequest $request): array
    {
        return $this->calendar->workingDates(
            $request->user,
            OfficeTime::local($request->start_at)->startOfDay(),
            OfficeTime::local($request->end_at)->startOfDay(),
        );
    }
}
