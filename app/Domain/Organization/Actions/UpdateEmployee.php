<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Services\EmployeeProfileWriter;
use App\Domain\Organization\Services\RoleChangeGuard;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Updates an employee's master data, roles and profile. Field changes are audited
 * by the Auditable trait (`user.updated`), roles by SyncUserRoles. Input must
 * already be validated (company email, ValidManager, team within division).
 */
final readonly class UpdateEmployee
{
    public function __construct(
        private SyncUserRoles $syncRoles,
        private RoleChangeGuard $roleGuard,
        private EmployeeProfileWriter $profiles,
    ) {}

    public function handle(User $actor, User $employee, EmployeeData $data): User
    {
        return DB::transaction(function () use ($actor, $employee, $data): User {
            $employee->fill([
                'name' => $data->name,
                'email' => $data->email,
                'division_id' => $data->divisionId,
                'team_id' => $data->teamId,
                'position_id' => $data->positionId,
                'manager_id' => $data->managerId,
                'work_mode' => $data->workMode,
                'joined_at' => $data->joinedAt?->toDateString(),
            ]);

            if ($employee->isDirty('email')) {
                // A new address must be linked to Google again on the next sign-in.
                $employee->google_id = null;
            }

            $employee->save();

            if ($data->roles !== []) {
                $before = RoleChangeGuard::rolesOf($employee);
                $this->roleGuard->authorize($actor, $employee, $before, $data->roles);
                $this->syncRoles->handle($employee, $data->roles, $actor);
            }

            $this->profiles->write($employee, $data, $actor);

            return $employee;
        });
    }
}
