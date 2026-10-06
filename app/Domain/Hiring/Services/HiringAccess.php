<?php

namespace App\Domain\Hiring\Services;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Who works in the Hiring space: HR & Super Admin manage everything; the
 * interviewers and final approvers HR assigned see the positions they are
 * on. Everyone else gets 404 (HiringPositionPolicy / CandidatePolicy).
 */
final class HiringAccess
{
    /** HR or Super Admin: full access to every position of the company. */
    public function isManager(User $user): bool
    {
        return $user->isActive() && $user->hasAnyRole([Role::Hr->value, Role::SuperAdmin->value]);
    }

    /**
     * Whether the user sees the Hiring space at all (nav entry, /hiring).
     * One small EXISTS query for non-managers.
     */
    public function canEnter(User $user): bool
    {
        if (! $user->isActive()) {
            return false;
        }

        return $this->isManager($user) || $this->isReviewerAnywhere($user);
    }

    public function isReviewerAnywhere(User $user): bool
    {
        return HiringPosition::query()
            ->where('company_id', $user->company_id)
            ->where(function ($scope) use ($user): void {
                $scope->whereJsonContains('interviewer_ids', $user->id)
                    ->orWhereJsonContains('final_approver_ids', $user->id);
            })
            ->exists();
    }

    /**
     * Active HR staff of the company (recipients of "kandidat baru" and
     * "kandidat diputus").
     *
     * @return Collection<int, User>
     */
    public function hrStaff(string $companyId): Collection
    {
        return User::query()
            ->where('company_id', $companyId)
            ->where('status', UserStatus::Active)
            ->role(Role::Hr->value)
            ->get();
    }

    /**
     * Keep only active employees of the company, in the given order, unique.
     *
     * @param  array<array-key, mixed>  $ids
     * @return list<string>
     */
    public function activeEmployeeIds(string $companyId, array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids, fn (mixed $id): bool => is_string($id) && $id !== '')));

        if ($ids === []) {
            return [];
        }

        $valid = User::query()
            ->where('company_id', $companyId)
            ->where('status', UserStatus::Active)
            ->whereIn('id', $ids)
            ->pluck('id')
            ->all();

        return array_values(array_filter($ids, fn (string $id): bool => in_array($id, $valid, true)));
    }
}
