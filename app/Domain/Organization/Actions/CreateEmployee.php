<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\EmployeeProfileWriter;
use App\Domain\Organization\Services\ManagerHierarchy;
use App\Domain\Organization\Services\RoleChangeGuard;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Registers a new employee in the actor's company. Employees sign in with Google,
 * so no password is set. Audited via the Auditable trait (`user.created`) and
 * SyncUserRoles (`user.roles_changed`). Input must already be validated.
 */
final readonly class CreateEmployee
{
    public function __construct(
        private SyncUserRoles $syncRoles,
        private RoleChangeGuard $roleGuard,
        private EmployeeProfileWriter $profiles,
        private ManagerHierarchy $hierarchy,
    ) {}

    public function handle(User $actor, EmployeeData $data): User
    {
        return DB::transaction(function () use ($actor, $data): User {
            $employee = User::query()->create([
                'company_id' => $actor->company_id,
                'name' => $data->name,
                'email' => $data->email,
                'password' => null,
                'division_id' => $data->divisionId,
                'team_id' => $data->teamId,
                'position_id' => $data->positionId,
                'manager_id' => $data->managerId,
                'work_mode' => $data->workMode,
                'status' => UserStatus::Active,
                'joined_at' => $data->joinedAt?->toDateString(),
            ]);

            // Same company lock as UpdateEmployee (a brand-new employee has no reports,
            // so no cycle is possible, but concurrent reporting-line writes serialize).
            $this->hierarchy->guardChange($employee, null, $data->managerId);

            // Company Workspace addresses are owned by the company: no verification mail.
            $employee->forceFill(['email_verified_at' => now()])->saveQuietly();

            $roles = $data->roles === [] ? [Role::Anggota] : $data->roles;
            $this->roleGuard->authorize($actor, $employee, [], $roles);
            $this->syncRoles->handle($employee, $roles, $actor);

            $this->profiles->write($employee, $data, $actor);

            return $employee;
        });
    }
}
