<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Services\EmployeeProfileWriter;
use App\Domain\Organization\Services\LeadershipReleaser;
use App\Domain\Organization\Services\ManagerHierarchy;
use App\Domain\Organization\Services\RoleChangeGuard;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Updates an employee's master data, roles and profile. Field changes are audited
 * by the Auditable trait (`user.updated`), roles by SyncUserRoles. Input must
 * already be validated (company email, ValidManager, team within division).
 * Moving out of a division/team releases its head/lead (LeadershipReleaser).
 */
final readonly class UpdateEmployee
{
    public function __construct(
        private SyncUserRoles $syncRoles,
        private RoleChangeGuard $roleGuard,
        private EmployeeProfileWriter $profiles,
        private LeadershipReleaser $leadership,
        private ManagerHierarchy $hierarchy,
    ) {}

    public function handle(User $actor, User $employee, EmployeeData $data): User
    {
        return DB::transaction(function () use ($actor, $employee, $data): User {
            $oldDivisionId = $employee->division_id;
            $oldTeamId = $employee->team_id;

            // Re-checked under a company lock: validation alone races (A → B vs B → A).
            $this->hierarchy->guardChange($employee, $employee->manager_id, $data->managerId);

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

            // Leaving a division/team ends heading/leading it.
            $this->leadership->releaseLeft($employee, $oldDivisionId, $oldTeamId, $actor);

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
