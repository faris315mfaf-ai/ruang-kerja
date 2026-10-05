<?php

namespace App\Domain\Requests\Services;

use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Is this user on approved leave now?" for the notification settings
 * ("tahan notifikasi saat cuti") and the daily digest: an approved whole-day
 * leave, sick leave, permit or business trip covering the moment.
 */
final class ApprovedLeaveAvailability implements UserAvailability
{
    public function isOnLeave(User $user, CarbonInterface $at): bool
    {
        return EmployeeRequest::query()
            ->ownedBy($user)
            ->where('status', RequestStatus::Approved->value)
            ->whereNull('minutes')
            ->where('start_at', '<=', $at)
            ->where('end_at', '>=', $at)
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn('category', [
                RequestCategory::Leave->value,
                RequestCategory::Sick->value,
                RequestCategory::Permit->value,
                RequestCategory::BusinessTrip->value,
            ]))
            ->exists();
    }
}
