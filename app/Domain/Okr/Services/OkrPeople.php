<?php

namespace App\Domain\Okr\Services;

use App\Domain\Organization\Enums\Role;
use App\Models\Division;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Who may own an objective or a key result of a division: active employees of
 * the division and its head (head_user_id). Used by the form selects and the
 * FormRequests (owner_id must be one of them).
 */
final class OkrPeople
{
    /**
     * @param  list<string>  $divisionIds
     * @return Builder<User>
     */
    public function query(string $companyId, array $divisionIds): Builder
    {
        return User::query()
            ->active()
            ->where('company_id', $companyId)
            ->where(function (Builder $people) use ($divisionIds): void {
                $people->whereIn('division_id', $divisionIds)
                    ->orWhereIn('id', Division::query()->whereIn('id', $divisionIds)->whereNotNull('head_user_id')->select('head_user_id'));
            });
    }

    /**
     * @return Collection<int, User>
     */
    public function forDivision(Division $division): Collection
    {
        return $this->query($division->company_id, [$division->id])->orderBy('name')->get(['id', 'name', 'division_id']);
    }

    public function isEligible(Division $division, string $userId): bool
    {
        return $this->query($division->company_id, [$division->id])->whereKey($userId)->exists();
    }

    /**
     * Kepala Divisi of a division: its head and the kepala_divisi holders
     * inside it (same rule as User::ledDivisionIds, without sub-divisions).
     *
     * @return Collection<int, User>
     */
    public function heads(Division $division): Collection
    {
        return User::query()
            ->active()
            ->where('company_id', $division->company_id)
            ->where(function (Builder $heads) use ($division): void {
                $heads->where(fn (Builder $role) => $role->where('division_id', $division->id)->role(Role::KepalaDivisi->value));

                if ($division->head_user_id !== null) {
                    $heads->orWhere('id', $division->head_user_id);
                }
            })
            ->get();
    }
}
