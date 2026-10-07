<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Actions\CancelApprovedRequest;
use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;

/**
 * What canceling an approved request would change (confirm dialog for HR,
 * CancelApprovedRequest): days given back, attendance dates touched, dates
 * already in the past, and a blocker when the cancel would be refused.
 */
final class ApprovedCancellationPreview
{
    public function __construct(private readonly AttendanceEffects $attendance) {}

    /**
     * @return array{refund_days: float|null, balance_year: int|null, attendance: array<string, mixed>, past_dates: list<string>, blocker: string|null, reason_min: int, reason_max: int}
     */
    public function for(EmployeeRequest $request): array
    {
        $request->loadMissing('leaveType');
        $plan = $this->attendance->revertPlan($request);
        $days = (float) ($request->days ?? 0);
        $quota = $request->leaveType->hasQuota() && $days > 0;
        $today = OfficeTime::todayString();

        $dates = array_values(array_filter([
            ...$plan->removedDates,
            ...$plan->unlinkedDates,
            $plan->overtimeDate,
            $plan->correctionDate,
        ], fn (?string $date): bool => $date !== null && $date < $today));

        return [
            'refund_days' => $quota ? round($days, 1) : null,
            'balance_year' => $quota ? BalanceLedger::yearOf($request) : null,
            'attendance' => $plan->toArray(),
            'past_dates' => $dates,
            'blocker' => $plan->blocker,
            'reason_min' => CancelApprovedRequest::REASON_MIN,
            'reason_max' => CancelApprovedRequest::reasonMax(),
        ];
    }
}
