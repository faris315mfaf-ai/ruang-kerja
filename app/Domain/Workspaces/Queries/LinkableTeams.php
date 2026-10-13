<?php

namespace App\Domain\Workspaces\Queries;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Teams a team workspace may be linked to (member sync): Super Admin → all,
 * Kepala Divisi → teams of the divisions they lead, Ketua Tim → own teams.
 * Shared by the web directory and the mobile API.
 */
final class LinkableTeams
{
    /**
     * @return list<array{id: string, name: string}>
     */
    public function for(User $user): array
    {
        $query = Team::query()->visibleTo($user)->orderBy('name');

        if (! $user->hasPermission(Permission::WorkspacesManage)) {
            $divisionIds = $user->hasRole(Role::KepalaDivisi) ? $user->ledDivisionIds() : [];

            $query->where(fn (Builder $scope) => $scope
                ->where('lead_user_id', $user->id)
                ->when($divisionIds !== [], fn (Builder $led) => $led->orWhereIn('division_id', $divisionIds)));
        }

        return array_values($query->get(['id', 'name'])
            ->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name])
            ->all());
    }
}
