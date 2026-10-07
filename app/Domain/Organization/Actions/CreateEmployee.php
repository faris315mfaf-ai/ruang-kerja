<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Auth\Services\DefaultPassword;
use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\EmployeeProfileWriter;
use App\Domain\Organization\Services\ManagerHierarchy;
use App\Domain\Organization\Services\RoleChangeGuard;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Registers a new employee in the actor's company (form and import). With the
 * company default password configured (EMPLOYEE_DEFAULT_PASSWORD, owner
 * decision 7 Oct 2026) the account gets it with "wajib ganti saat login
 * berikutnya"; otherwise — and always for a Super Admin — no password is set
 * (HR uses Atur kata sandi, or the employee Lupa kata sandi). Audited via the
 * Auditable trait (`user.created`, the password masked) and SyncUserRoles
 * (`user.roles_changed`). Input must already be validated.
 */
final readonly class CreateEmployee
{
    public function __construct(
        private SyncUserRoles $syncRoles,
        private RoleChangeGuard $roleGuard,
        private EmployeeProfileWriter $profiles,
        private ManagerHierarchy $hierarchy,
        private DefaultPassword $defaultPassword,
    ) {}

    public function handle(User $actor, EmployeeData $data): User
    {
        $roles = $data->roles === [] ? [Role::Anggota] : $data->roles;
        $withDefault = $this->defaultPassword->enabled() && ! in_array(Role::SuperAdmin, $roles, true);

        return DB::transaction(function () use ($actor, $data, $roles, $withDefault): User {
            $employee = User::query()->create([
                'company_id' => $actor->company_id,
                'name' => $data->name,
                'email' => $data->email,
                'password' => $withDefault ? $this->defaultPassword->hash() : null,
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
            $employee->forceFill([
                'email_verified_at' => now(),
                'password_change_required' => $withDefault,
            ])->saveQuietly();

            $this->roleGuard->authorize($actor, $employee, [], $roles);
            $this->syncRoles->handle($employee, $roles, $actor);

            $this->profiles->write($employee, $data, $actor);

            return $employee;
        });
    }
}
