<?php

use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->admin = User::factory()->withRole(Role::SuperAdmin)->create(['name' => 'Admin Sistem']);
    // Start every test from an empty trail (creating users is audited too).
    AuditLog::query()->delete();
});

it('is only available to Super Admin', function (Role $role) {
    $this->actingAs(User::factory()->withRole($role)->create())
        ->get('/admin/audit')
        ->assertForbidden();
})->with([Role::Hr, Role::Direksi, Role::KepalaDivisi, Role::Anggota]);

it('requires authentication', function () {
    $this->get('/admin/audit')->assertRedirect(route('login'));
});

it('lists the newest changes first with actor, subject and before/after values', function () {
    $this->travelTo(now()->subHour());
    $this->actingAs($this->admin);
    $division = Division::factory()->create(['name' => 'Keuangan', 'code' => 'KEU']);
    $this->travelBack();
    $division->update(['name' => 'Keuangan & Pajak']);

    $this->get('/admin/audit')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/audit/index')
            ->where('logs.total', 2)
            ->where('logs.data.0.action', 'division.updated')
            ->where('logs.data.0.actor.name', 'Admin Sistem')
            ->where('logs.data.0.subject.type', 'divisi')
            ->where('logs.data.0.subject.typeLabel', 'Divisi')
            ->where('logs.data.0.subject.name', 'Keuangan & Pajak')
            ->where('logs.data.0.subject.deleted', false)
            ->where('logs.data.0.oldValues', ['name' => 'Keuangan'])
            ->where('logs.data.0.newValues', ['name' => 'Keuangan & Pajak'])
            ->where('logs.data.1.action', 'division.created')
            ->where('options.actions', ['division.created', 'division.updated'])
            ->where('options.actors.0.value', 'sistem')
            ->where('options.actors.1.label', 'Admin Sistem')
            ->has('options.subjects', 5),
        );
});

it('resolves referenced ids to names and keeps names of deleted subjects', function () {
    $this->actingAs($this->admin);
    $head = User::factory()->create(['name' => 'Agus Setiawan']);
    $division = Division::factory()->create(['name' => 'Legal', 'code' => 'LGL']);
    $division->update(['head_user_id' => $head->id]);
    $division->delete();

    $this->get('/admin/audit?aksi=division.updated')
        ->assertInertia(fn (Assert $page) => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.subject.name', 'Legal')
            ->where('logs.data.0.subject.deleted', true)
            ->where("references.{$head->id}", 'Agus Setiawan'),
        );
});

it('filters by actor, including system changes', function () {
    $hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana']);
    AuditLog::query()->delete();
    AuditLog::factory()->by($hr)->create(['action' => 'division.created']);
    AuditLog::factory()->create(['user_id' => null, 'action' => 'team.created']);

    $this->actingAs($this->admin)
        ->get("/admin/audit?aktor={$hr->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('logs.total', 1)
            ->where('logs.data.0.actor.name', 'Hana')
            ->where('filters.aktor', $hr->id),
        );

    $this->actingAs($this->admin)
        ->get('/admin/audit?aktor=sistem')
        ->assertInertia(fn (Assert $page) => $page
            ->where('logs.total', 1)
            ->where('logs.data.0.action', 'team.created')
            ->where('logs.data.0.actor', null),
        );
});

it('filters by exact action or by action group', function () {
    AuditLog::factory()->create(['action' => 'division.created']);
    AuditLog::factory()->create(['action' => 'division.deleted']);
    AuditLog::factory()->create(['action' => 'user.roles_changed']);

    $this->actingAs($this->admin)
        ->get('/admin/audit?aksi=division.deleted')
        ->assertInertia(fn (Assert $page) => $page->where('logs.total', 1));

    $this->actingAs($this->admin)
        ->get('/admin/audit?aksi=division.')
        ->assertInertia(fn (Assert $page) => $page->where('logs.total', 2));

    $this->actingAs($this->admin)
        ->get('/admin/audit?aksi=user.roles_changed')
        ->assertInertia(fn (Assert $page) => $page->where('logs.total', 1));
});

it('filters by subject type', function () {
    $this->actingAs($this->admin);
    Division::factory()->create();
    Team::factory()->create(); // creates its own division as well

    $this->get('/admin/audit?subjek=tim')
        ->assertInertia(fn (Assert $page) => $page
            ->where('logs.total', 1)
            ->where('logs.data.0.subject.type', 'tim'),
        );

    $this->get('/admin/audit?subjek=divisi')
        ->assertInertia(fn (Assert $page) => $page->where('logs.total', 2));
});

it('filters by a date range in the office timezone', function () {
    // 2026-10-04 23:30 WIB = 16:30 UTC, still 4 October in the office.
    AuditLog::factory()->create(['action' => 'a.early', 'created_at' => '2026-10-03 16:59:59']); // 3 Okt 23:59 WIB
    AuditLog::factory()->create(['action' => 'a.inside', 'created_at' => '2026-10-04 16:30:00']); // 4 Okt 23:30 WIB
    AuditLog::factory()->create(['action' => 'a.late', 'created_at' => '2026-10-04 17:00:00']); // 5 Okt 00:00 WIB

    $this->actingAs($this->admin)
        ->get('/admin/audit?dari=2026-10-04&sampai=2026-10-04')
        ->assertInertia(fn (Assert $page) => $page
            ->where('logs.total', 1)
            ->where('logs.data.0.action', 'a.inside'),
        );
});

it('rejects invalid filters', function (string $query, string $field) {
    $this->actingAs($this->admin)
        ->get("/admin/audit?{$query}")
        ->assertSessionHasErrors($field);
})->with([
    'unknown subject' => ['subjek=gaji', 'subjek'],
    'bad date' => ['dari=04-10-2026', 'dari'],
    'range reversed' => ['dari=2026-10-05&sampai=2026-10-01', 'sampai'],
    'bad action' => ['aksi=DROP%20TABLE', 'aksi'],
]);

it('paginates 25 rows per page and keeps the filters in the links', function () {
    AuditLog::factory()->count(30)->create(['action' => 'division.updated']);

    $this->actingAs($this->admin)
        ->get('/admin/audit?aksi=division.updated&page=2')
        ->assertInertia(fn (Assert $page) => $page
            ->has('logs.data', 5)
            ->where('logs.currentPage', 2)
            ->where('logs.lastPage', 2)
            ->where('logs.from', 26)
            ->where('logs.nextUrl', null)
            ->where('logs.prevUrl', fn (string $url) => str_contains($url, 'aksi=division.updated') && str_contains($url, 'page=1')),
        );
});

it('hides changes made by people of another company', function () {
    $stranger = User::factory()->forCompany(Company::factory()->create())->create();
    AuditLog::query()->delete();
    AuditLog::factory()->by($stranger)->create(['action' => 'division.created']);

    $this->actingAs($this->admin)
        ->get('/admin/audit')
        ->assertInertia(fn (Assert $page) => $page->where('logs.total', 0));
});

it('never exposes masked secrets', function () {
    AuditLog::factory()->create([
        'action' => 'user.updated',
        'old_values' => ['password' => '***'],
        'new_values' => ['password' => '***'],
    ]);

    $this->actingAs($this->admin)
        ->get('/admin/audit')
        ->assertInertia(fn (Assert $page) => $page->where('logs.data.0.newValues.password', '***'));
});
