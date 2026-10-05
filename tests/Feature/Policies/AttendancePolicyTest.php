<?php

use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\Division;
use App\Models\User;
use App\Policies\AttendanceDayPolicy;
use App\Policies\AttendanceLogPolicy;
use App\Policies\HolidayPolicy;
use App\Policies\OfficeLocationPolicy;
use App\Policies\ShiftAssignmentPolicy;
use App\Policies\ShiftPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('auto-discovers the attendance policies', function () {
    expect(Gate::getPolicyFor(OfficeLocation::class))->toBeInstanceOf(OfficeLocationPolicy::class)
        ->and(Gate::getPolicyFor(Shift::class))->toBeInstanceOf(ShiftPolicy::class)
        ->and(Gate::getPolicyFor(ShiftAssignment::class))->toBeInstanceOf(ShiftAssignmentPolicy::class)
        ->and(Gate::getPolicyFor(Holiday::class))->toBeInstanceOf(HolidayPolicy::class)
        ->and(Gate::getPolicyFor(AttendanceDay::class))->toBeInstanceOf(AttendanceDayPolicy::class)
        ->and(Gate::getPolicyFor(AttendanceLog::class))->toBeInstanceOf(AttendanceLogPolicy::class);
});

dataset('attendance managers', [
    'super_admin' => [Role::SuperAdmin, true],
    'hr' => [Role::Hr, true],
    'direksi' => [Role::Direksi, false],
    'kepala_divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

dataset('master data', [
    'office location' => [fn () => OfficeLocation::factory()->create()],
    'shift' => [fn () => Shift::factory()->create()],
    'holiday' => [fn () => Holiday::factory()->create()],
]);

it('lets everyone in the company see locations, shifts and holidays', function (Closure $make, Role $role) {
    $model = $make();
    $gate = Gate::forUser(User::factory()->withRole($role)->create());

    expect($gate->allows('viewAny', $model::class))->toBeTrue()
        ->and($gate->allows('view', $model))->toBeTrue();
})->with('master data')->with(Role::cases());

it('lets only HR and Super Admin manage locations, shifts and holidays', function (Closure $make, Role $role, bool $expected) {
    $model = $make();
    $gate = Gate::forUser(User::factory()->withRole($role)->create());

    expect($gate->allows('create', $model::class))->toBe($expected)
        ->and($gate->allows('update', $model))->toBe($expected)
        ->and($gate->allows('delete', $model))->toBe($expected);
})->with('master data')->with('attendance managers');

it('keeps master data of another company out of reach', function (Closure $make) {
    $model = $make();
    $other = Company::factory()->create();
    $model->forceFill(['company_id' => $other->id])->save();
    $gate = Gate::forUser(User::factory()->withRole(Role::Hr)->create());

    expect($gate->allows('view', $model))->toBeFalse()
        ->and($gate->allows('update', $model))->toBeFalse();
})->with('master data');

it('lets only HR and Super Admin assign shifts', function (Role $role, bool $expected) {
    $actor = User::factory()->withRole($role)->create();
    $employee = User::factory()->create();
    $assignment = ShiftAssignment::factory()->for($employee)->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('viewAny', ShiftAssignment::class))->toBe($expected)
        ->and($gate->allows('create', [ShiftAssignment::class, $employee]))->toBe($expected)
        ->and($gate->allows('delete', $assignment))->toBe($expected)
        ->and($gate->allows('manage', OfficeLocation::class))->toBe($expected);
})->with('attendance managers');

it('scopes attendance days: self, direct reports, led division, or everyone with view_all', function () {
    $division = Division::factory()->create();
    $otherDivision = Division::factory()->create();
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($division)->create();
    $division->update(['head_user_id' => $kadiv->id]);
    $report = User::factory()->withRole(Role::Anggota)->managedBy($kadiv)->inDivision($division)->create();
    $member = User::factory()->withRole(Role::Anggota)->inDivision($division)->create();
    $outsider = User::factory()->withRole(Role::Anggota)->inDivision($otherDivision)->create();

    $days = collect([$kadiv, $report, $member, $outsider])
        ->mapWithKeys(fn (User $user) => [$user->id => AttendanceDay::factory()->for($user)->create()]);

    $visible = fn (User $viewer) => AttendanceDay::query()->visibleTo($viewer)->pluck('user_id')->sort()->values()->all();
    $ids = fn (User ...$users) => collect($users)->pluck('id')->sort()->values()->all();

    expect($visible($kadiv))->toBe($ids($kadiv, $report, $member))
        ->and($visible($report))->toBe($ids($report))
        ->and($visible($outsider))->toBe($ids($outsider));

    foreach ([Role::Hr, Role::Direksi, Role::SuperAdmin] as $role) {
        expect($visible(User::factory()->withRole($role)->create()))->toBe($ids($kadiv, $report, $member, $outsider));
    }

    expect(Gate::forUser($report)->allows('view', $days[$member->id]))->toBeFalse()
        ->and(Gate::forUser($kadiv)->allows('view', $days[$member->id]))->toBeTrue()
        ->and(Gate::forUser($kadiv)->allows('view', $days[$outsider->id]))->toBeFalse();
});

it('authorizes the live attendance feeds', function (Role $role, bool $company) {
    $actor = User::factory()->withRole($role)->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('viewCompanyFeed', AttendanceDay::class))->toBe($company)
        ->and($gate->allows('viewDivisionFeed', [AttendanceDay::class, Division::factory()->create()]))->toBe($company);
})->with([
    'super_admin' => [Role::SuperAdmin, true],
    'hr' => [Role::Hr, true],
    'direksi' => [Role::Direksi, true],
    'kepala_divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

it('lets a Kepala Divisi follow only the division they lead', function () {
    $division = Division::factory()->create();
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($division)->create();
    $gate = Gate::forUser($kadiv);

    expect($gate->allows('viewDivisionFeed', [AttendanceDay::class, $division]))->toBeTrue()
        ->and($gate->allows('viewDivisionFeed', [AttendanceDay::class, Division::factory()->create()]))->toBeFalse();
});

it('limits selfies to the employee, HR and the direct manager', function () {
    $manager = User::factory()->withRole(Role::KepalaDivisi)->create();
    $employee = User::factory()->withRole(Role::Anggota)->managedBy($manager)->create();
    $log = AttendanceLog::factory()->forDay(AttendanceDay::factory()->for($employee)->create())->create();

    $allowed = fn (User $actor) => Gate::forUser($actor)->allows('viewSelfie', $log);

    expect($allowed($employee))->toBeTrue()
        ->and($allowed($manager))->toBeTrue()
        ->and($allowed(User::factory()->withRole(Role::Hr)->create()))->toBeTrue()
        ->and($allowed(User::factory()->withRole(Role::SuperAdmin)->create()))->toBeFalse()
        ->and($allowed(User::factory()->withRole(Role::Direksi)->create()))->toBeFalse()
        ->and($allowed(User::factory()->withRole(Role::KepalaDivisi)->create()))->toBeFalse()
        ->and($allowed(User::factory()->withRole(Role::Anggota)->create()))->toBeFalse()
        ->and(Gate::forUser($employee)->allows('update', $log))->toBeFalse()
        ->and(Gate::forUser($employee)->allows('delete', $log))->toBeFalse();
});

it('lets every active employee check in and give consent', function (Role $role) {
    $gate = Gate::forUser(User::factory()->withRole($role)->create());

    expect($gate->allows('checkIn', AttendanceDay::class))->toBeTrue()
        ->and($gate->allows('create', AttendanceConsent::class))->toBeTrue()
        ->and($gate->allows('revoke', AttendanceConsent::class))->toBeTrue();
})->with(Role::cases());
