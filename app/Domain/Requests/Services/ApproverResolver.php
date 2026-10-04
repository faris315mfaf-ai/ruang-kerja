<?php

namespace App\Domain\Requests\Services;

use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\ManagerHierarchy;
use App\Domain\Requests\Enums\ApproverType;
use App\Models\ApprovalDelegation;
use App\Models\Division;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Who is behind an approver type for a given requester.
 */
final class ApproverResolver
{
    public function __construct(private readonly ManagerHierarchy $hierarchy) {}

    /**
     * Person for a personal step (direct manager, division head, fixed user):
     * active and in the requester's company, or null.
     */
    public function person(ApproverType $type, ?string $userId, User $requester): ?User
    {
        $person = match ($type) {
            ApproverType::DirectManager => $requester->manager,
            ApproverType::DivisionHead => $this->divisionHead($requester),
            ApproverType::User => $userId === null ? null : User::query()->find($userId),
            ApproverType::Role => null,
        };

        if ($person === null || ! $person->isActive() || $person->company_id !== $requester->company_id) {
            return null;
        }

        return $person;
    }

    /**
     * Head of the requester's division, walking up to parent divisions when a
     * division has no head.
     */
    public function divisionHead(User $requester): ?User
    {
        $division = $requester->division;

        for ($depth = 0; $division !== null && $depth < 20; $depth++) {
            if ($division->head_user_id !== null) {
                return $division->head;
            }

            $division = $division->parent_id === null ? null : Division::query()->find($division->parent_id);
        }

        return null;
    }

    /**
     * Active holders of a global role in the requester's company, requester excluded.
     *
     * @return Builder<User>
     */
    public function roleHolders(string $role, User $requester): Builder
    {
        return User::query()
            ->where('company_id', $requester->company_id)
            ->where('status', UserStatus::Active->value)
            ->whereKeyNot($requester->id)
            ->whereHas('roles', fn (Builder $roles) => $roles->where('name', $role));
    }

    /**
     * First active manager above the requester not in $exclude (escalation when
     * the approver would be the requester and self-skip is off).
     *
     * @param  list<string>  $exclude
     */
    public function escalate(User $requester, array $exclude = []): ?User
    {
        foreach ($this->hierarchy->chainOf($requester) as $manager) {
            if ($manager->isActive() && ! in_array($manager->id, $exclude, true)) {
                return $manager;
            }
        }

        return null;
    }

    /**
     * Active delegate standing in for $approver on the office date, if any.
     */
    public function activeDelegate(User $approver, string $date): ?User
    {
        $delegation = ApprovalDelegation::query()
            ->where('delegator_id', $approver->id)
            ->activeOn($date)
            ->latest('starts_on')
            ->with('delegate')
            ->first();

        $delegate = $delegation?->delegate;

        return $delegate !== null && $delegate->isActive() ? $delegate : null;
    }
}
