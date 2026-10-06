<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Domain\RoleDashboards\Services\RoleDashboardAccess;
use App\Models\AuditLog;
use App\Models\Position;
use App\Models\User;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\RoleDashboardDemoSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.role_dashboards' => true]);
    $this->travelTo('2026-10-05 03:00:00');
});

/**
 * An active employee whose position carries $role.
 */
function jobHolder(DashboardRole $role, Role $global = Role::Anggota): User
{
    $position = Position::factory()->create(['dashboard_role' => $role->value]);

    return User::factory()->withRole($global)->create(['position_id' => $position->id]);
}

dataset('jobs', fn (): array => array_map(fn (DashboardRole $role): array => [$role], DashboardRole::cases()));

describe('access matrix', function () {
    it('opens the own job dashboard and hides every other job', function (DashboardRole $role) {
        $holder = jobHolder($role);

        $this->actingAs($holder)->get("/peran/{$role->value}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('roles/show')
                ->where('role', $role->value)
                ->has('roles', 1)
                ->where('roles.0.value', $role->value));

        foreach (DashboardRole::cases() as $other) {
            if ($other !== $role) {
                $this->actingAs($holder)->get("/peran/{$other->value}")->assertNotFound();
            }
        }
    })->with('jobs');

    it('lets Direksi and Super Admin open every job', function (Role $global) {
        $viewer = User::factory()->withRole($global)->create();

        foreach (DashboardRole::cases() as $role) {
            $this->actingAs($viewer)->get("/peran/{$role->value}")
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page->where('role', $role->value)->has('roles', 8));
        }
    })->with([Role::Direksi, Role::SuperAdmin]);

    it('answers 404 to employees without a job dashboard', function (Role $global) {
        $viewer = User::factory()->withRole($global)->create();

        $this->actingAs($viewer)->get('/peran')->assertNotFound();
        $this->actingAs($viewer)->get('/peran/hr')->assertNotFound();
    })->with([Role::Anggota, Role::KepalaDivisi, Role::Hr]);

    it('locks out deactivated holders', function () {
        $holder = jobHolder(DashboardRole::Hr, Role::Hr);
        $holder->forceFill(['status' => 'inactive'])->save();

        expect(app(RoleDashboardAccess::class)->can($holder->fresh(), DashboardRole::Hr))->toBeFalse();
        // EnsureActiveEmployee signs them out before the dashboard is reached.
        $this->actingAs($holder)->get('/peran/hr')->assertRedirect();
        $this->assertGuest();
    });

    it('rejects unknown job keys', function () {
        $this->actingAs(User::factory()->withRole(Role::Direksi)->create())->get('/peran/bendahara')->assertNotFound();
    });

    it('sends guests to the login page', function () {
        $this->get('/peran/dirut')->assertRedirect(route('login'));
    });
});

describe('/peran', function () {
    it('lands on the own position dashboard', function () {
        $holder = jobHolder(DashboardRole::Programming, Role::KepalaDivisi);

        $this->actingAs($holder)->get('/peran')->assertRedirect('/peran/programming');
    });

    it('lands Direksi without a job position on Direktur Utama', function () {
        $this->actingAs(User::factory()->withRole(Role::Direksi)->create())->get('/peran')->assertRedirect('/peran/dirut');
    });

    it('prefers the own job of a Direksi member', function () {
        $direktur = jobHolder(DashboardRole::Direktur, Role::Direksi);

        $this->actingAs($direktur)->get('/peran')->assertRedirect('/peran/direktur');
    });
});

describe('feature flag', function () {
    it('answers 404 everywhere while off and hides the shell entry', function () {
        config(['features.role_dashboards' => false]);
        $direksi = User::factory()->withRole(Role::Direksi)->create();

        $this->actingAs($direksi)->get('/peran')->assertNotFound();
        $this->actingAs($direksi)->get('/peran/dirut')->assertNotFound();
        $this->actingAs($direksi)->post('/peran/dirut/keputusan/01k0000000000000000000000a')->assertNotFound();
        $this->actingAs($direksi)->post('/peran/hr/persetujuan/01k0000000000000000000000a/setujui')->assertNotFound();
        $this->actingAs($direksi)->get('/menu')->assertInertia(fn (Assert $page) => $page->where('features.role_dashboards', false));
    });

    it('shares the shell entry only with people who have access', function () {
        $this->actingAs(jobHolder(DashboardRole::Marketing))->get('/menu')
            ->assertInertia(fn (Assert $page) => $page->where('features.role_dashboards', true));
        $this->actingAs(User::factory()->withRole(Role::Direksi)->create())->get('/menu')
            ->assertInertia(fn (Assert $page) => $page->where('features.role_dashboards', true));
        $this->actingAs(User::factory()->withRole(Role::Anggota)->create())->get('/menu')
            ->assertInertia(fn (Assert $page) => $page->where('features.role_dashboards', false));
    });

    it('hides the position field while off', function () {
        $hr = User::factory()->withRole(Role::Hr)->create();

        $this->actingAs($hr)->get('/admin/organisasi/jabatan')
            ->assertInertia(fn (Assert $page) => $page->has('options.dashboardRoles', 8));

        config(['features.role_dashboards' => false]);
        $this->actingAs($hr)->get('/admin/organisasi/jabatan')
            ->assertInertia(fn (Assert $page) => $page->has('options.dashboardRoles', 0));
    });
});

describe('Admin › Organisasi › Jabatan', function () {
    it('lets HR map a position to a job dashboard, audited', function () {
        $hr = User::factory()->withRole(Role::Hr)->create();
        $position = Position::factory()->create(['name' => 'Kepala Divisi Programming', 'level' => 2]);

        $this->actingAs($hr)->put("/admin/organisasi/jabatan/{$position->id}", [
            'name' => 'Kepala Divisi Programming', 'level' => 2, 'dashboard_role' => 'programming',
        ])->assertRedirect()->assertSessionHasNoErrors();

        expect($position->fresh()?->dashboard_role)->toBe(DashboardRole::Programming)
            ->and(AuditLog::query()->where('action', 'position.updated')->where('auditable_id', $position->id)->exists())->toBeTrue();

        // Omitting the field (older client, flag off) keeps the mapping.
        $this->actingAs($hr)->put("/admin/organisasi/jabatan/{$position->id}", ['name' => 'Kadiv Programming', 'level' => 2])
            ->assertSessionHasNoErrors();
        expect($position->fresh()?->dashboard_role)->toBe(DashboardRole::Programming);

        // Explicit null clears it.
        $this->actingAs($hr)->put("/admin/organisasi/jabatan/{$position->id}", ['name' => 'Kadiv Programming', 'level' => 2, 'dashboard_role' => null])
            ->assertSessionHasNoErrors();
        expect($position->fresh()?->dashboard_role)->toBeNull();
    });

    it('rejects an unknown job key', function () {
        $hr = User::factory()->withRole(Role::Hr)->create();

        $this->actingAs($hr)->post('/admin/organisasi/jabatan', ['name' => 'Bendahara', 'level' => 3, 'dashboard_role' => 'bendahara'])
            ->assertSessionHasErrors(['dashboard_role' => 'Dashboard jabatan tidak valid.']);
    });

    it('lists the mapping in the positions table', function () {
        $hr = User::factory()->withRole(Role::Hr)->create();
        Position::factory()->create(['name' => 'Sekretaris Perusahaan', 'dashboard_role' => 'corsec']);

        $this->actingAs($hr)->get('/admin/organisasi/jabatan')
            ->assertInertia(fn (Assert $page) => $page->where('positions', fn ($rows) => collect($rows)->contains(fn ($row) => $row['name'] === 'Sekretaris Perusahaan' && $row['dashboardRole'] === 'corsec' && $row['dashboardRoleLabel'] === 'Sekretaris Perusahaan')));
    });

    it('enforces the 8 keys in the database', function () {
        $position = Position::factory()->create();

        expect(fn () => DB::table('positions')->where('id', $position->id)->update(['dashboard_role' => 'bendahara']))
            ->toThrow(QueryException::class);
    });
});

describe('demo seeder', function () {
    it('maps the demo positions once, without overriding HR', function () {
        $this->seed(OrganizationSeeder::class);
        $this->seed(RoleDashboardDemoSeeder::class);

        expect(Position::query()->where('name', 'Direktur Utama')->value('dashboard_role'))->toBe(DashboardRole::Dirut)
            ->and(Position::query()->where('name', 'Kepala Divisi SDM')->value('dashboard_role'))->toBe(DashboardRole::Hr)
            ->and(Position::query()->whereNotNull('dashboard_role')->count())->toBe(6);

        Position::query()->where('name', 'Kepala Divisi Operasional')->update(['dashboard_role' => 'analis']);
        $this->seed(RoleDashboardDemoSeeder::class);

        expect(Position::query()->where('name', 'Kepala Divisi Operasional')->value('dashboard_role'))->toBe(DashboardRole::Analis);
        $this->actingAs(User::query()->where('email', 'kadiv@demo.test')->firstOrFail())->get('/peran')->assertRedirect('/peran/analis');
    });
});
