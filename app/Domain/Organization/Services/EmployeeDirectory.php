<?php

namespace App\Domain\Organization\Services;

use App\Domain\Organization\Data\EmployeeFilters;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Division;
use App\Models\Position;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Employee list for Admin › Karyawan: always scoped by User::visibleTo($viewer),
 * then searched, filtered, sorted and paginated on the server.
 */
final class EmployeeDirectory
{
    public const string NO_DIVISION = 'none';

    /**
     * @return LengthAwarePaginator<int, User>
     */
    public function paginate(User $viewer, EmployeeFilters $filters): LengthAwarePaginator
    {
        $query = $this->query($viewer, $filters)->with([
            'division:id,name,code',
            'team:id,name,division_id',
            'position:id,name,level',
            'manager:id,name,avatar_url',
            'roles:id,name',
        ]);

        return $query->paginate($filters->perPage)->withQueryString();
    }

    /**
     * @return Builder<User>
     */
    public function query(User $viewer, EmployeeFilters $filters): Builder
    {
        $query = User::query()->visibleTo($viewer);

        if ($filters->search !== null) {
            $term = '%'.addcslashes($filters->search, '%_\\').'%';

            $query->where(function (Builder $search) use ($term): void {
                $search->where('users.name', 'ilike', $term)
                    ->orWhere('users.email', 'ilike', $term)
                    ->orWhereHas('position', fn (Builder $position) => $position->where('name', 'ilike', $term));
            });
        }

        if ($filters->division === self::NO_DIVISION) {
            $query->whereNull('users.division_id');
        } elseif ($filters->division !== null) {
            $query->where('users.division_id', $filters->division);
        }

        $role = $filters->role;

        if ($role !== null) {
            $query->whereHas('roles', fn (Builder $roles) => $roles->where('name', $role->value));
        }

        if ($filters->status !== null) {
            $query->where('users.status', $filters->status->value);
        }

        $this->sort($query, $filters->sort, $filters->direction);

        return $query;
    }

    /**
     * Active vs. not active (inactive + resigned) within the viewer's scope.
     *
     * @return array{active: int, inactive: int}
     */
    public function counts(User $viewer): array
    {
        $active = User::query()->visibleTo($viewer)->where('status', UserStatus::Active->value)->count();
        $total = User::query()->visibleTo($viewer)->count();

        return ['active' => $active, 'inactive' => $total - $active];
    }

    /**
     * Visible employees per division (for the mobile filter chips).
     *
     * @return array<string, int>
     */
    public function countsByDivision(User $viewer): array
    {
        /** @var array<string, int> $counts */
        $counts = User::query()->visibleTo($viewer)
            ->whereNotNull('division_id')
            ->groupBy('division_id')
            ->selectRaw('division_id, count(*) as aggregate')
            ->pluck('aggregate', 'division_id')
            ->map(fn (mixed $count): int => is_numeric($count) ? (int) $count : 0)
            ->all();

        return $counts;
    }

    /**
     * @param  Builder<User>  $query
     * @param  'asc'|'desc'  $direction
     */
    private function sort(Builder $query, string $sort, string $direction): void
    {
        match ($sort) {
            'division' => $query->orderBy(
                Division::query()->select('name')->whereColumn('divisions.id', 'users.division_id'),
                $direction,
            ),
            'position' => $query->orderBy(
                Position::query()->select('name')->whereColumn('positions.id', 'users.position_id'),
                $direction,
            ),
            'manager' => $query->orderBy(
                User::query()->from('users as managers')->select('managers.name')->whereColumn('managers.id', 'users.manager_id'),
                $direction,
            ),
            'work_mode' => $query->orderBy('users.work_mode', $direction),
            'joined_at' => $query->orderBy('users.joined_at', $direction),
            'status' => $query->orderBy('users.status', $direction),
            default => null,
        };

        // Stable order (and the primary order for "name").
        $query->orderBy('users.name', $sort === 'name' ? $direction : 'asc')->orderBy('users.id');
    }
}
