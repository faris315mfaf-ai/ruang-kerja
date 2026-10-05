<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->ops = Division::factory()->forCompany($this->company)->create(['name' => 'Operasional', 'code' => 'OPS']);
    $this->keu = Division::factory()->forCompany($this->company)->create(['name' => 'Keuangan', 'code' => 'KEU']);
    $this->gudang = Team::factory()->create(['division_id' => $this->ops->id, 'name' => 'Tim Gudang']);
    $this->staff = Position::factory()->create(['company_id' => $this->company->id, 'name' => 'Staf Operasional', 'level' => 5]);

    $this->hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create(['email' => 'hr@kantor.test']);
});

/**
 * @return array<string, mixed>
 */
function employeePayload(array $overrides = []): array
{
    return [
        'name' => 'Bayu Saputra',
        'email' => 'bayu@kantor.test',
        'division_id' => test()->ops->id,
        'team_id' => test()->gudang->id,
        'position_id' => test()->staff->id,
        'manager_id' => null,
        'work_mode' => WorkMode::Hybrid->value,
        'joined_at' => '2023-02-14',
        'roles' => [Role::Anggota->value],
        'employee_number' => 'RK-0100',
        'phone' => '+62 812 0000 1111',
        'nik' => '3201 0101 0101 0001',
        ...$overrides,
    ];
}

describe('list', function () {
    it('shows the employee table to HR with server-side search, filter and sort', function () {
        User::factory()->forCompany($this->company)->inDivision($this->ops)->create(['name' => 'Agus Ops']);
        User::factory()->forCompany($this->company)->inDivision($this->keu)->create(['name' => 'Budi Keu']);
        User::factory()->forCompany($this->company)->inDivision($this->keu)->inactive()->create(['name' => 'Citra Keu']);

        $this->actingAs($this->hr)
            ->get(route('admin.employees.index', ['division' => $this->keu->id, 'sort' => 'name', 'direction' => 'desc']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/employees/index')
                ->where('employees.meta.total', 2)
                ->where('employees.data.0.name', 'Citra Keu')
                ->where('employees.data.1.name', 'Budi Keu')
                ->where('counts', ['active' => 3, 'inactive' => 1])
                ->where('can.manage', true)
                ->where('can.assignSuperAdmin', false)
                ->has('formOptions.managers')
            );

        $this->actingAs($this->hr)
            ->get(route('admin.employees.index', ['search' => 'agus']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('employees.meta.total', 1)
                ->where('employees.data.0.name', 'Agus Ops')
            );

        $this->actingAs($this->hr)
            ->get(route('admin.employees.index', ['status' => 'inactive']))
            ->assertInertia(fn (Assert $page) => $page->where('employees.meta.total', 1));
    });

    it('filters by role', function () {
        User::factory()->forCompany($this->company)->withRole(Role::KepalaDivisi)->create(['name' => 'Kadiv']);

        $this->actingAs($this->hr)
            ->get(route('admin.employees.index', ['role' => 'kepala_divisi']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('employees.meta.total', 1)
                ->where('employees.data.0.roles', ['kepala_divisi'])
            );
    });

    it('ignores unknown filter values instead of failing', function () {
        $this->actingAs($this->hr)
            ->get(route('admin.employees.index', ['sort' => 'password', 'direction' => 'x', 'per_page' => 999, 'role' => 'root']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sort', 'name')
                ->where('filters.per_page', 10)
                ->where('filters.role', null)
            );
    });

    it('forbids anggota from every admin employee endpoint', function () {
        $anggota = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create();
        $other = User::factory()->forCompany($this->company)->create();

        $this->actingAs($anggota)->get(route('admin.employees.index'))->assertForbidden();
        $this->actingAs($anggota)->get(route('admin.employees.show', $other))->assertForbidden();
        $this->actingAs($anggota)->get(route('admin.employees.show', $anggota))->assertForbidden();
        $this->actingAs($anggota)->post(route('admin.employees.store'), employeePayload())->assertForbidden();
        $this->actingAs($anggota)->put(route('admin.employees.update', $other), employeePayload())->assertForbidden();
        $this->actingAs($anggota)->post(route('admin.employees.deactivate', $other), ['status' => 'inactive', 'reason' => 'Uji'])->assertForbidden();
        $this->actingAs($anggota)->get(route('admin.employees.import'))->assertForbidden();

        expect(User::query()->where('email', 'bayu@kantor.test')->exists())->toBeFalse();
    });

    it('lets a kepala divisi read only their own division', function () {
        $kadiv = User::factory()->forCompany($this->company)->inDivision($this->ops)->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas']);
        $member = User::factory()->forCompany($this->company)->inDivision($this->ops)->create(['name' => 'Rizky']);
        $outsider = User::factory()->forCompany($this->company)->inDivision($this->keu)->create(['name' => 'Lestari']);

        $this->actingAs($kadiv)
            ->get(route('admin.employees.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('employees.meta.total', 2)
                ->where('can.manage', false)
                ->where('formOptions', null)
                ->where('employees.data.0.can.update', false)
                ->has('divisions', 1)
                ->where('divisions.0.id', $this->ops->id)
            );

        $this->actingAs($kadiv)->get(route('admin.employees.show', $member))->assertOk();
        $this->actingAs($kadiv)->get(route('admin.employees.show', $outsider))->assertForbidden();
        $this->actingAs($kadiv)->put(route('admin.employees.update', $member), employeePayload(['email' => 'rizky@kantor.test']))->assertForbidden();
        $this->actingAs($kadiv)->post(route('admin.employees.store'), employeePayload())->assertForbidden();
        $this->actingAs($kadiv)->get(route('admin.employees.index', ['edit' => $member->id]))
            ->assertInertia(fn (Assert $page) => $page->where('editing', null));
    });

    it('never lists employees of another company', function () {
        $foreign = Company::factory()->create();
        User::factory()->forCompany($foreign)->create(['name' => 'Asing']);

        $this->actingAs($this->hr)
            ->get(route('admin.employees.index', ['search' => 'Asing']))
            ->assertInertia(fn (Assert $page) => $page->where('employees.meta.total', 0));
    });
});

describe('create & update', function () {
    it('lets HR create an employee with profile and roles, audited', function () {
        $this->actingAs($this->hr)
            ->from(route('admin.employees.index'))
            ->post(route('admin.employees.store'), employeePayload())
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('admin.employees.index'));

        $bayu = User::query()->where('email', 'bayu@kantor.test')->firstOrFail();

        expect($bayu->company_id)->toBe($this->company->id)
            ->and($bayu->division_id)->toBe($this->ops->id)
            ->and($bayu->team_id)->toBe($this->gudang->id)
            ->and($bayu->work_mode)->toBe(WorkMode::Hybrid)
            ->and($bayu->status)->toBe(UserStatus::Active)
            ->and($bayu->password)->toBeNull()
            ->and($bayu->email_verified_at)->not->toBeNull()
            ->and($bayu->getRoleNames()->all())->toBe(['anggota'])
            ->and($bayu->profile?->nik)->toBe('3201010101010001')
            ->and($bayu->profile?->employee_number)->toBe('RK-0100');

        $actions = AuditLog::query()->where('auditable_id', $bayu->id)->pluck('action')->all();
        expect($actions)->toContain('user.created', 'user.roles_changed', 'employee_profile.updated');

        // NIK never reaches the audit trail.
        $raw = AuditLog::query()->where('auditable_id', $bayu->id)->get()->toJson();
        expect($raw)->not->toContain('3201010101010001');
    });

    it('lets HR update an employee and keeps the NIK when left empty', function () {
        $bayu = User::factory()->forCompany($this->company)->inDivision($this->ops)->withRole(Role::Anggota)->create(['email' => 'bayu@kantor.test']);
        EmployeeProfile::factory()->create(['user_id' => $bayu->id, 'nik' => '3201010101010001', 'employee_number' => 'RK-0100']);
        $manager = User::factory()->forCompany($this->company)->create();

        $this->actingAs($this->hr)
            ->put(route('admin.employees.update', $bayu), employeePayload([
                'name' => 'Bayu S.',
                'division_id' => $this->keu->id,
                'team_id' => null,
                'manager_id' => $manager->id,
                'roles' => ['anggota', 'kepala_divisi'],
                'nik' => '',
            ]))
            ->assertSessionHasNoErrors();

        $bayu->refresh();

        expect($bayu->name)->toBe('Bayu S.')
            ->and($bayu->division_id)->toBe($this->keu->id)
            ->and($bayu->team_id)->toBeNull()
            ->and($bayu->manager_id)->toBe($manager->id)
            ->and($bayu->getRoleNames()->sort()->values()->all())->toBe(['anggota', 'kepala_divisi'])
            ->and($bayu->profile?->nik)->toBe('3201010101010001');

        expect(AuditLog::query()->where('auditable_id', $bayu->id)->where('action', 'user.updated')->exists())->toBeTrue();
    });

    it('exposes only a masked NIK in the edit panel', function () {
        $bayu = User::factory()->forCompany($this->company)->create();
        EmployeeProfile::factory()->create(['user_id' => $bayu->id, 'nik' => '3201010101019876']);

        $response = $this->actingAs($this->hr)->get(route('admin.employees.index', ['edit' => $bayu->id]));

        $response->assertInertia(fn (Assert $page) => $page
            ->where('editing.id', $bayu->id)
            ->where('editing.nik_masked', '••••••••••••9876')
        );
        expect($response->getContent())->not->toContain('3201010101019876');
    });

    it('rejects an email outside the company domain', function () {
        $this->actingAs($this->hr)
            ->post(route('admin.employees.store'), employeePayload(['email' => 'bayu@gmail.com']))
            ->assertSessionHasErrors(['email' => 'Email harus memakai domain kantor @kantor.test.']);

        $this->actingAs($this->hr)
            ->post(route('admin.employees.store'), employeePayload(['email' => 'bayu@evilkantor.test']))
            ->assertSessionHasErrors('email');

        expect(User::query()->where('email', 'like', 'bayu@%')->exists())->toBeFalse();
    });

    it('rejects a duplicate email and a team from another division', function () {
        User::factory()->forCompany($this->company)->create(['email' => 'bayu@kantor.test']);

        $this->actingAs($this->hr)
            ->post(route('admin.employees.store'), employeePayload(['division_id' => $this->keu->id]))
            ->assertSessionHasErrors(['email', 'team_id']);
    });

    it('rejects a reporting cycle', function () {
        $a = User::factory()->forCompany($this->company)->create(['email' => 'a@kantor.test']);
        $b = User::factory()->forCompany($this->company)->managedBy($a)->create(['email' => 'b@kantor.test']);
        $c = User::factory()->forCompany($this->company)->managedBy($b)->create(['email' => 'c@kantor.test']);

        $this->actingAs($this->hr)
            ->put(route('admin.employees.update', $a), employeePayload(['email' => 'a@kantor.test', 'manager_id' => $b->id]))
            ->assertSessionHasErrors('manager_id');

        $this->actingAs($this->hr)
            ->put(route('admin.employees.update', $a), employeePayload(['email' => 'a@kantor.test', 'manager_id' => $c->id]))
            ->assertSessionHasErrors('manager_id');

        $this->actingAs($this->hr)
            ->put(route('admin.employees.update', $a), employeePayload(['email' => 'a@kantor.test', 'manager_id' => $a->id]))
            ->assertSessionHasErrors('manager_id');

        expect($a->refresh()->manager_id)->toBeNull();
    });

    it('does not let HR grant super_admin or edit a super admin', function () {
        $this->actingAs($this->hr)
            ->post(route('admin.employees.store'), employeePayload(['roles' => ['anggota', 'super_admin']]))
            ->assertSessionHasErrors(['roles.1' => 'Hanya Super Admin yang dapat memberikan peran Super Admin.']);

        $bayu = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create(['email' => 'bayu@kantor.test']);

        $this->actingAs($this->hr)
            ->put(route('admin.employees.update', $bayu), employeePayload(['roles' => ['super_admin']]))
            ->assertSessionHasErrors('roles.0');

        expect($bayu->refresh()->hasRole(Role::SuperAdmin))->toBeFalse();

        $admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);

        $this->actingAs($this->hr)
            ->put(route('admin.employees.update', $admin), employeePayload(['email' => 'admin@kantor.test', 'roles' => ['anggota']]))
            ->assertForbidden();

        expect($admin->refresh()->hasRole(Role::SuperAdmin))->toBeTrue();
    });

    it('lets a super admin grant super_admin', function () {
        $admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create();

        $this->actingAs($admin)
            ->post(route('admin.employees.store'), employeePayload(['roles' => ['super_admin']]))
            ->assertSessionHasNoErrors();

        expect(User::query()->where('email', 'bayu@kantor.test')->firstOrFail()->hasRole(Role::SuperAdmin))->toBeTrue();
    });

    it('locks the email once the employee has signed in', function () {
        $bayu = User::factory()->forCompany($this->company)->create(['email' => 'bayu@kantor.test', 'last_login_at' => now()]);

        $this->actingAs($this->hr)
            ->put(route('admin.employees.update', $bayu), employeePayload(['email' => 'bayu.baru@kantor.test']))
            ->assertSessionHasErrors('email');

        expect($bayu->refresh()->email)->toBe('bayu@kantor.test');
    });
});

describe('deactivate & reactivate', function () {
    it('deactivates with a reason, audits it, and the employee is logged out', function () {
        $boss = User::factory()->forCompany($this->company)->create();
        $bayu = User::factory()->forCompany($this->company)->managedBy($boss)->create();
        $report = User::factory()->forCompany($this->company)->managedBy($bayu)->create();

        // Bayu is signed in on his own device.
        $this->actingAs($bayu)->get(route('dashboard'))->assertOk();

        $this->actingAs($this->hr)
            ->post(route('admin.employees.deactivate', $bayu), [
                'status' => 'resigned',
                'reason' => 'Mengundurkan diri per 1 Oktober',
                'reassign_reports' => true,
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        expect($bayu->refresh()->status)->toBe(UserStatus::Resigned)
            ->and($report->refresh()->manager_id)->toBe($boss->id);

        $log = AuditLog::query()->where('auditable_id', $bayu->id)->where('action', 'user.deactivated')->sole();
        expect($log->new_values)->toEqual(['status' => 'resigned', 'reason' => 'Mengundurkan diri per 1 Oktober'])
            ->and($log->user_id)->toBe($this->hr->id);

        // His next request signs him out.
        $this->actingAs($bayu)
            ->get(route('dashboard'))
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors(['email' => EnsureActiveEmployee::MESSAGE]);
        $this->assertGuest();
    });

    it('requires a reason and an inactive status, and HR cannot deactivate themselves', function () {
        $bayu = User::factory()->forCompany($this->company)->create();

        $this->actingAs($this->hr)
            ->post(route('admin.employees.deactivate', $bayu), ['status' => 'active', 'reason' => ''])
            ->assertSessionHasErrors(['status', 'reason']);

        $this->actingAs($this->hr)
            ->post(route('admin.employees.deactivate', $this->hr), ['status' => 'inactive', 'reason' => 'Uji coba'])
            ->assertForbidden();

        expect($bayu->refresh()->status)->toBe(UserStatus::Active);
    });

    it('reactivates an employee', function () {
        $bayu = User::factory()->forCompany($this->company)->inactive()->create();

        $this->actingAs($this->hr)
            ->post(route('admin.employees.reactivate', $bayu), ['reason' => 'Kembali bekerja'])
            ->assertSessionHasNoErrors();

        expect($bayu->refresh()->status)->toBe(UserStatus::Active)
            ->and(AuditLog::query()->where('auditable_id', $bayu->id)->where('action', 'user.reactivated')->exists())->toBeTrue();
    });
});

describe('detail page', function () {
    it('shows profile, placement, direct reports and recent audit to HR', function () {
        $bayu = User::factory()->forCompany($this->company)->inDivision($this->ops, $this->gudang)->create(['name' => 'Bayu']);
        EmployeeProfile::factory()->create(['user_id' => $bayu->id, 'nik' => '3201010101011234']);
        User::factory()->forCompany($this->company)->managedBy($bayu)->create(['name' => 'Bawahan']);
        $this->travel(1)->minute();
        $bayu->update(['work_mode' => WorkMode::Wfh]);

        $this->actingAs($this->hr)
            ->get(route('admin.employees.show', $bayu))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/employees/show')
                ->where('employee.name', 'Bayu')
                ->where('employee.team.name', 'Tim Gudang')
                ->where('employee.nik_masked', '••••••••••••1234')
                ->has('directReports', 1)
                ->where('directReports.0.name', 'Bawahan')
                ->where('audit.0.action', 'user.updated')
                ->where('audit.0.fields', ['work_mode'])
            );
    });

    it('hides audit and NIK from read-only viewers', function () {
        $direksi = User::factory()->forCompany($this->company)->withRole(Role::Direksi)->create();
        $bayu = User::factory()->forCompany($this->company)->create();
        EmployeeProfile::factory()->create(['user_id' => $bayu->id]);

        $this->actingAs($direksi)
            ->get(route('admin.employees.show', $bayu))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('audit', null)
                ->where('employee.nik_masked', null)
                ->where('can.update', false)
            );
    });
});
