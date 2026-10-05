<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Finds an existing request that occupies the same period:
 * absences (cuti/izin/sakit/dinas) clash with each other, overtime with
 * overtime, corrections with corrections (same date).
 */
final class OverlapDetector
{
    public function find(
        User $user,
        RequestCategory $category,
        CarbonInterface $startAt,
        CarbonInterface $endAt,
        ?string $ignoreId = null,
    ): ?EmployeeRequest {
        $group = $category->isAbsence()
            ? array_values(array_filter(RequestCategory::cases(), fn (RequestCategory $c): bool => $c->isAbsence()))
            : [$category];

        return EmployeeRequest::query()
            ->ownedBy($user)
            ->whereIn('status', RequestStatus::values(RequestStatus::occupying()))
            ->when($ignoreId !== null, fn (Builder $query) => $query->whereKeyNot($ignoreId))
            ->where('start_at', '<', $endAt)
            ->where('end_at', '>', $startAt)
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn(
                'category',
                array_map(fn (RequestCategory $c): string => $c->value, $group),
            ))
            ->with('leaveType')
            ->orderBy('start_at')
            ->first();
    }
}
