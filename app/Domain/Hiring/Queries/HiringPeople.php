<?php

namespace App\Domain\Hiring\Queries;

use App\Domain\Organization\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * People shown in the Hiring screens (pickers for interviewers and final
 * approvers, reviewer names on checklists, scores and decisions).
 */
final class HiringPeople
{
    /**
     * Active employees of the company, by name (pickers). One query.
     *
     * @return list<array{id: string, name: string, avatar: string|null, position: string|null}>
     */
    public function options(string $companyId): array
    {
        return array_values(User::query()
            ->where('company_id', $companyId)
            ->where('status', UserStatus::Active)
            ->with('position:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_url', 'position_id'])
            ->map(fn (User $user): array => self::person($user))
            ->all());
    }

    /**
     * Users by id (inactive included: their past points and decisions stay readable). One query.
     *
     * @param  list<string>  $ids
     * @return Collection<string, User>
     */
    public function byId(array $ids): Collection
    {
        if ($ids === []) {
            return collect();
        }

        return User::query()
            ->whereIn('id', array_values(array_unique($ids)))
            ->with('position:id,name')
            ->get(['id', 'name', 'avatar_url', 'position_id', 'status'])
            ->keyBy('id');
    }

    /**
     * @return array{id: string, name: string, avatar: string|null, position: string|null}
     */
    public static function person(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar' => $user->avatar_url,
            'position' => $user->relationLoaded('position') ? $user->position?->name : null,
        ];
    }
}
