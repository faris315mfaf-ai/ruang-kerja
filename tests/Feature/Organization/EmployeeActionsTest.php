<?php

use App\Domain\Organization\Actions\CreateEmployee;
use App\Domain\Organization\Actions\DeactivateEmployee;
use App\Domain\Organization\Actions\ReactivateEmployee;
use App\Domain\Organization\Actions\UpdateEmployee;
use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Data\EmployeeFilters;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Services\EmployeeDirectory;
use App\Http\Presenters\EmployeePresenter;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->hr = User::factory()->withRole(Role::Hr)->create();
});

function employeeData(array $roles = [Role::Anggota], ?string $nik = null): EmployeeData
{
    return new EmployeeData(
        name: 'Bayu',
        email: 'bayu@example.test',
        divisionId: null,
        teamId: null,
        positionId: null,
        managerId: null,
        workMode: WorkMode::Office,
        joinedAt: null,
        roles: $roles,
        nik: $nik,
    );
}

it('refuses to grant super_admin inside CreateEmployee even without the form (defense in depth)', function () {
    expect(fn () => app(CreateEmployee::class)->handle($this->hr, employeeData([Role::SuperAdmin])))
        ->toThrow(AuthorizationException::class);

    // The whole transaction was rolled back.
    expect(User::query()->where('email', 'bayu@example.test')->exists())->toBeFalse();
});

it('refuses HR granting direksi/hr or changing own roles inside the actions (defense in depth)', function (Role $role) {
    expect(fn () => app(CreateEmployee::class)->handle($this->hr, employeeData([$role])))
        ->toThrow(AuthorizationException::class);

    $bayu = app(CreateEmployee::class)->handle($this->hr, employeeData());

    expect(fn () => app(UpdateEmployee::class)->handle($this->hr, $bayu, employeeData([$role])))
        ->toThrow(AuthorizationException::class)
        ->and($bayu->refresh()->hasRole($role))->toBeFalse();

    $selfData = new EmployeeData(
        name: $this->hr->name, email: $this->hr->email, divisionId: null, teamId: null, positionId: null,
        managerId: null, workMode: WorkMode::Office, joinedAt: null, roles: [Role::Hr, Role::KepalaDivisi], nik: null,
    );

    expect(fn () => app(UpdateEmployee::class)->handle($this->hr, $this->hr, $selfData))
        ->toThrow(AuthorizationException::class);
})->with([Role::Direksi, Role::Hr]);

it('defaults new employees to the anggota role and skips an empty profile', function () {
    $bayu = app(CreateEmployee::class)->handle($this->hr, employeeData([]));

    expect($bayu->getRoleNames()->all())->toBe(['anggota'])
        ->and($bayu->profile()->exists())->toBeFalse();
});

it('audits profile changes by field name only and ignores an unchanged NIK', function () {
    $bayu = app(CreateEmployee::class)->handle($this->hr, employeeData(nik: '3201010101010001'));
    $before = AuditLog::query()->where('action', 'employee_profile.updated')->count();

    app(UpdateEmployee::class)->handle($this->hr, $bayu, employeeData(nik: '3201010101010001'));

    expect(AuditLog::query()->where('action', 'employee_profile.updated')->count())->toBe($before);

    app(UpdateEmployee::class)->handle($this->hr, $bayu, employeeData(nik: '3201010101010002'));

    $log = AuditLog::query()->where('action', 'employee_profile.updated')->latest('created_at')->orderByDesc('id')->first();
    expect($log?->new_values)->toBe(['fields' => ['nik']]);
});

it('deactivates without moving reports unless asked, and rejects the active status', function () {
    $bayu = User::factory()->create();
    $report = User::factory()->managedBy($bayu)->create();

    expect(app(DeactivateEmployee::class)->handle($this->hr, $bayu, UserStatus::Inactive, 'Cuti panjang'))->toBe(0)
        ->and($report->refresh()->manager_id)->toBe($bayu->id)
        ->and($bayu->refresh()->status)->toBe(UserStatus::Inactive);

    // Exactly one audit row for the status change (no generic user.updated).
    expect(AuditLog::query()->where('auditable_id', $bayu->id)->pluck('action')->all())->toEqualCanonicalizing(['user.created', 'user.deactivated']);

    expect(fn () => app(DeactivateEmployee::class)->handle($this->hr, $bayu, UserStatus::Active, 'x'))
        ->toThrow(InvalidArgumentException::class);
});

it('reactivates idempotently', function () {
    $bayu = User::factory()->inactive()->create();

    app(ReactivateEmployee::class)->handle($this->hr, $bayu);
    app(ReactivateEmployee::class)->handle($this->hr, $bayu);

    expect($bayu->refresh()->status)->toBe(UserStatus::Active)
        ->and(AuditLog::query()->where('action', 'user.reactivated')->count())->toBe(1);
});

it('masks NIK keeping the last four digits', function () {
    expect(EmployeePresenter::maskNik('3201010101019876'))->toBe('••••••••••••9876')
        ->and(EmployeePresenter::maskNik(null))->toBeNull()
        ->and(EmployeePresenter::maskNik(''))->toBeNull();
});

it('parses list filters defensively', function () {
    $filters = EmployeeFilters::fromRequest(Request::create('/', 'GET', [
        'search' => '  bayu  ', 'role' => 'hr', 'status' => 'resigned', 'sort' => 'joined_at', 'direction' => 'desc', 'per_page' => '25',
    ]));

    expect($filters->toArray())->toBe([
        'search' => 'bayu', 'division' => null, 'role' => 'hr', 'status' => 'resigned',
        'sort' => 'joined_at', 'direction' => 'desc', 'per_page' => 25,
    ]);
});

it('escapes LIKE wildcards in the search term', function () {
    User::factory()->create(['name' => 'Persen 100%']);
    User::factory()->create(['name' => 'Biasa']);

    $result = app(EmployeeDirectory::class)->query($this->hr, new EmployeeFilters(search: '%'))->pluck('name')->all();

    expect($result)->toBe(['Persen 100%']);
});
