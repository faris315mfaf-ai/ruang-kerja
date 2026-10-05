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
});

it('lists teams with their division, lead and active member count', function (Role $role) {
    $division = Division::factory()->create(['name' => 'Operasional', 'code' => 'OPS']);
    $lead = User::factory()->inDivision($division)->create(['name' => 'Sari Wulandari']);
    $team = Team::factory()->for($division)->ledBy($lead)->create(['name' => 'Tim Gudang', 'code' => 'GDG']);
    $lead->update(['team_id' => $team->id]);
    User::factory()->inDivision($division, $team)->create();
    User::factory()->inactive()->inDivision($division, $team)->create();

    $this->actingAs(User::factory()->withRole($role)->create())
        ->get('/admin/organisasi/tim')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/organization/index')
            ->where('tab', 'tim')
            ->has('teams', 1)
            ->where('teams.0.name', 'Tim Gudang')
            ->where('teams.0.divisionCode', 'OPS')
            ->where('teams.0.lead.name', 'Sari Wulandari')
            ->where('teams.0.membersCount', 2),
        );
})->with([Role::SuperAdmin, Role::Hr]);

it('creates and updates a team with an audit trail', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $division = Division::factory()->create();
    $lead = User::factory()->inDivision($division)->create();

    $this->actingAs($hr)
        ->post('/admin/organisasi/tim', ['division_id' => $division->id, 'name' => 'Tim Gudang', 'code' => 'gdg', 'lead_user_id' => $lead->id])
        ->assertSessionHasNoErrors();

    $team = Team::query()->where('name', 'Tim Gudang')->sole();
    expect($team->code)->toBe('GDG')->and($team->lead_user_id)->toBe($lead->id);

    $this->actingAs($hr)
        ->put("/admin/organisasi/tim/{$team->id}", ['division_id' => $division->id, 'name' => 'Tim Logistik', 'code' => ''])
        ->assertSessionHasNoErrors();

    expect($team->fresh())
        ->name->toBe('Tim Logistik')
        ->code->toBeNull()
        ->lead_user_id->toBeNull();

    expect(AuditLog::query()->where('auditable_id', $team->id)->pluck('action')->sort()->values()->all())
        ->toBe(['team.created', 'team.updated']);
});

it('validates teams', function (Closure $input, string $field) {
    $division = Division::factory()->create();
    Team::factory()->for($division)->create(['code' => 'GDG']);

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->post('/admin/organisasi/tim', [...['division_id' => $division->id, 'name' => 'Tim Baru'], ...$input($division)])
        ->assertSessionHasErrors($field);
})->with([
    'missing division' => [fn () => ['division_id' => ''], 'division_id'],
    'foreign division' => [fn () => ['division_id' => Division::factory()->forCompany(Company::factory()->create())->create()->id], 'division_id'],
    'deleted division' => [fn () => ['division_id' => tap(Division::factory()->create())->delete()->id], 'division_id'],
    'missing name' => [fn () => ['name' => ''], 'name'],
    'code too long' => [fn () => ['code' => 'ABCDEFGHIJK'], 'code'],
    'code with symbols' => [fn () => ['code' => 'G-1'], 'code'],
    'duplicate code in division' => [fn () => ['code' => 'gdg'], 'code'],
    'inactive lead' => [fn () => ['lead_user_id' => User::factory()->inactive()->create()->id], 'lead_user_id'],
]);

it('allows the same team code in another division', function () {
    Team::factory()->create(['code' => 'DGT']);
    $division = Division::factory()->create();

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->post('/admin/organisasi/tim', ['division_id' => $division->id, 'name' => 'Tim Digital', 'code' => 'DGT'])
        ->assertSessionHasNoErrors();
});

it('refuses to delete a team with active members', function () {
    $team = Team::factory()->create(['name' => 'Tim Gudang']);
    User::factory()->count(3)->inDivision($team->division, $team)->create();

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->delete("/admin/organisasi/tim/{$team->id}")
        ->assertSessionHasErrors(['team' => 'Tim Gudang masih memiliki 3 anggota aktif. Keluarkan anggota dari tim terlebih dahulu.']);

    expect($team->fresh()?->trashed())->toBeFalse();
});

it('soft-deletes an empty team and restores it', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $team = Team::factory()->create();

    $this->actingAs($hr)->delete("/admin/organisasi/tim/{$team->id}")->assertSessionHasNoErrors();
    expect(Team::withTrashed()->find($team->id)?->trashed())->toBeTrue();

    $this->actingAs($hr)->post("/admin/organisasi/tim/{$team->id}/pulihkan")->assertSessionHasNoErrors();
    expect($team->fresh()?->trashed())->toBeFalse();
});

it('refuses to restore a team whose division is deleted', function () {
    $team = Team::factory()->create();
    $team->delete();
    $team->division->delete();

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->post("/admin/organisasi/tim/{$team->id}/pulihkan")
        ->assertSessionHasErrors('team');

    expect(Team::withTrashed()->find($team->id)?->trashed())->toBeTrue();
});

it('forbids team management to other roles', function (Role $role) {
    $team = Team::factory()->create();
    $actor = User::factory()->withRole($role)->create();

    $this->actingAs($actor)->post('/admin/organisasi/tim', ['division_id' => $team->division_id, 'name' => 'X'])->assertForbidden();
    $this->actingAs($actor)->put("/admin/organisasi/tim/{$team->id}", ['division_id' => $team->division_id, 'name' => 'X'])->assertForbidden();
    $this->actingAs($actor)->delete("/admin/organisasi/tim/{$team->id}")->assertForbidden();
})->with([Role::Direksi, Role::KepalaDivisi, Role::Anggota]);

it('keeps an already-inactive lead on unrelated edits but rejects switching to an inactive lead', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $division = Division::factory()->forCompany($hr->company)->create();
    $staleLead = User::factory()->forCompany($hr->company)->inactive()->create();
    $team = Team::factory()->for($division)->ledBy($staleLead)->create(['name' => 'Tim Gudang']);

    $this->actingAs($hr)
        ->put("/admin/organisasi/tim/{$team->id}", ['division_id' => $division->id, 'name' => 'Tim Logistik', 'lead_user_id' => $staleLead->id])
        ->assertSessionHasNoErrors();

    expect($team->refresh()->name)->toBe('Tim Logistik');

    $this->actingAs($hr)
        ->put("/admin/organisasi/tim/{$team->id}", ['division_id' => $division->id, 'name' => 'Tim Logistik', 'lead_user_id' => User::factory()->forCompany($hr->company)->inactive()->create()->id])
        ->assertSessionHasErrors(['lead_user_id' => 'Ketua tim harus karyawan aktif di perusahaan ini.']);
});
