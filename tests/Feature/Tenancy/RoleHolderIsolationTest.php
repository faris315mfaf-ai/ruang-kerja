<?php

use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\Company;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Database\Seeders\RoleSeeder;

/*
 * Plan item #6 (Fase 1): "people holding the HR role" means HR of the
 * requester's own company.
 */

it('counts a step as waiting for HR only when the approver is HR of the same company', function () {
    $this->seed(RoleSeeder::class);
    $employee = User::factory()->create();
    $ownHr = User::factory()->forCompany(Company::query()->findOrFail($employee->company_id))->withRole(Role::Hr)->create();
    $foreignHr = User::factory()->forCompany(Company::factory()->foreign()->create())->withRole(Role::Hr)->create();

    $request = fn (): EmployeeRequest => EmployeeRequest::factory()->status(RequestStatus::Pending)->create(['user_id' => $employee->id]);
    RequestApproval::factory()->create(['request_id' => $request()->id, 'approver_id' => $foreignHr->id]);

    expect(app(HrDashboard::class)->pendingHr([$employee->id])['count'])->toBe(0);

    RequestApproval::factory()->create(['request_id' => $request()->id, 'approver_id' => $ownHr->id]);

    expect(app(HrDashboard::class)->pendingHr([$employee->id])['count'])->toBe(1);
});
