<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use Illuminate\Database\Eloquent\Builder;

/**
 * Approved overtime is the single source of attendance_days.overtime_minutes:
 * the sum of approved overtime requests whose work date (payload.date) is that day.
 */
final class ApprovedOvertime
{
    public function minutesFor(string $userId, string $workDate): int
    {
        return (int) EmployeeRequest::query()
            ->where('user_id', $userId)
            ->where('status', RequestStatus::Approved->value)
            ->where('payload->date', $workDate)
            ->whereHas('leaveType', fn (Builder $type) => $type->where('category', RequestCategory::Overtime->value))
            ->sum('minutes');
    }
}
