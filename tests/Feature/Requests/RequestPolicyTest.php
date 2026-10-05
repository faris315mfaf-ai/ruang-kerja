<?php

use App\Domain\Organization\Enums\Role;
use App\Models\ApprovalDelegation;
use App\Models\ApprovalFlow;
use App\Models\Company;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

dataset('roles that manage requests', [
    'super_admin' => [Role::SuperAdmin, true],
    'hr' => [Role::Hr, true],
    'direksi' => [Role::Direksi, false],
    'kepala_divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

it('lets only HR and Super Admin manage leave types, flows and balances', function (Role $role, bool $expected) {
    $actor = User::factory()->withRole($role)->create();
    $gate = Gate::forUser($actor);
    $balance = LeaveBalance::factory()->create(['leave_type_id' => $this->s->annual->id]);

    expect($gate->allows('viewAny', LeaveType::class))->toBeTrue()
        ->and($gate->allows('view', $this->s->annual))->toBeTrue()
        ->and($gate->allows('create', LeaveType::class))->toBe($expected)
        ->and($gate->allows('update', $this->s->annual))->toBe($expected)
        ->and($gate->allows('delete', $this->s->annual))->toBe($expected)
        ->and($gate->allows('forceDelete', $this->s->annual))->toBeFalse()
        ->and($gate->allows('viewAny', ApprovalFlow::class))->toBe($expected)
        ->and($gate->allows('update', $this->s->flow))->toBe($expected)
        ->and($gate->allows('update', $this->s->flow->steps->first()))->toBe($expected)
        ->and($gate->allows('viewAny', LeaveBalance::class))->toBe($expected)
        ->and($gate->allows('update', $balance))->toBe($expected)
        ->and($gate->allows('delete', $balance))->toBeFalse();
})->with('roles that manage requests');

it('denies managing another company\'s types and flows', function () {
    $outsider = User::factory()->forCompany(Company::factory()->create())->withRole(Role::SuperAdmin)->create();
    $gate = Gate::forUser($outsider);

    expect($gate->allows('update', $this->s->annual))->toBeFalse()
        ->and($gate->allows('update', $this->s->flow))->toBeFalse()
        ->and($gate->allows('view', $this->s->annual))->toBeFalse();
});

it('scopes request visibility by role and involvement', function (Role $role, bool $sees) {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $actor = User::factory()->withRole($role)->create();

    expect(Gate::forUser($actor)->allows('view', $request))->toBe($sees)
        ->and(EmployeeRequest::query()->visibleTo($actor)->whereKey($request->id)->exists())->toBe($sees);
})->with([
    'super_admin' => [Role::SuperAdmin, true],
    'hr' => [Role::Hr, true],
    'direksi' => [Role::Direksi, true],
    'kepala_divisi (other division)' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

it('gives the requester edit/cancel and the approver decide', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    expect($s->employee->can('view', $request))->toBeTrue()
        ->and($s->employee->can('cancel', $request))->toBeTrue()
        ->and($s->employee->can('update', $request))->toBeFalse()
        ->and($s->employee->can('decide', $request))->toBeFalse()
        ->and($s->employee->can('delete', $request))->toBeFalse()
        ->and($s->manager->can('decide', $request))->toBeTrue()
        ->and($s->manager->can('cancel', $request))->toBeFalse()
        ->and($s->hr->can('decide', $request))->toBeFalse()
        ->and($s->direksi->can('decide', $request))->toBeFalse();

    expect(EmployeeRequest::query()->visibleTo($s->manager)->count())->toBe(1);
});

it('lets the delegator or HR end a delegation', function () {
    $s = $this->s;
    $delegation = ApprovalDelegation::factory()->create(['delegator_id' => $s->manager->id, 'delegate_id' => $s->employee->id]);

    expect($s->manager->can('delete', $delegation))->toBeTrue()
        ->and($s->employee->can('delete', $delegation))->toBeFalse()
        ->and($s->employee->can('view', $delegation))->toBeTrue()
        ->and($s->hr->can('delete', $delegation))->toBeTrue()
        ->and($s->direksi->can('delete', $delegation))->toBeFalse();
});
