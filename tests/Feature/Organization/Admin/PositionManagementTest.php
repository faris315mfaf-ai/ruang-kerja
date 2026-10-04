<?php

use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Position;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('lists positions by level with holder counts', function (Role $role) {
    $staff = Position::factory()->level(5)->create(['name' => 'Staf Keuangan']);
    Position::factory()->level(1)->create(['name' => 'Direktur Utama']);
    User::factory()->create(['position_id' => $staff->id]);
    User::factory()->resigned()->create(['position_id' => $staff->id]);

    $this->actingAs(User::factory()->withRole($role)->create())
        ->get('/admin/organisasi/jabatan')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('tab', 'jabatan')
            ->has('positions', 2)
            ->where('positions.0.name', 'Direktur Utama')
            ->where('positions.0.levelLabel', 'Direksi')
            ->where('positions.1.usersCount', 1),
        );
})->with([Role::SuperAdmin, Role::Hr]);

it('creates and updates positions', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();

    $this->actingAs($hr)->post('/admin/organisasi/jabatan', ['name' => 'Staf Legal', 'level' => 5])->assertSessionHasNoErrors();
    $position = Position::query()->where('name', 'Staf Legal')->sole();

    $this->actingAs($hr)->put("/admin/organisasi/jabatan/{$position->id}", ['name' => 'Spesialis Legal', 'level' => 4])->assertSessionHasNoErrors();

    expect($position->fresh())->name->toBe('Spesialis Legal')->level->toBe(4)
        ->and(AuditLog::query()->where('auditable_id', $position->id)->count())->toBe(2);
});

it('validates positions', function (array $input, string $field) {
    Position::factory()->create(['name' => 'Staf Keuangan']);

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->post('/admin/organisasi/jabatan', [...['name' => 'Staf Baru', 'level' => 5], ...$input])
        ->assertSessionHasErrors($field);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'duplicate name (case-insensitive)' => [['name' => 'staf keuangan'], 'name'],
    'level below range' => [['level' => 0], 'level'],
    'level above range' => [['level' => 6], 'level'],
    'level not a number' => [['level' => 'staf'], 'level'],
]);

it('refuses to delete a position that active employees hold', function () {
    $position = Position::factory()->create(['name' => 'Staf Gudang']);
    User::factory()->count(2)->create(['position_id' => $position->id]);

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->delete("/admin/organisasi/jabatan/{$position->id}")
        ->assertSessionHasErrors(['position' => 'Jabatan Staf Gudang masih dipakai 2 karyawan aktif. Ganti jabatan mereka terlebih dahulu.']);
});

it('soft-deletes an unused position, then restores it unless the name was reused', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $position = Position::factory()->create(['name' => 'Staf Arsip']);

    $this->actingAs($hr)->delete("/admin/organisasi/jabatan/{$position->id}")->assertSessionHasNoErrors();
    expect(Position::withTrashed()->find($position->id)?->trashed())->toBeTrue();

    $reused = Position::factory()->create(['name' => 'Staf Arsip']);
    $this->actingAs($hr)->post("/admin/organisasi/jabatan/{$position->id}/pulihkan")->assertSessionHasErrors('position');

    $reused->delete();
    $this->actingAs($hr)->post("/admin/organisasi/jabatan/{$position->id}/pulihkan")->assertSessionHasNoErrors();
    expect($position->fresh()?->trashed())->toBeFalse();
});

it('forbids position management to other roles', function (Role $role) {
    $position = Position::factory()->create();
    $actor = User::factory()->withRole($role)->create();

    $this->actingAs($actor)->post('/admin/organisasi/jabatan', ['name' => 'X', 'level' => 5])->assertForbidden();
    $this->actingAs($actor)->put("/admin/organisasi/jabatan/{$position->id}", ['name' => 'X', 'level' => 5])->assertForbidden();
    $this->actingAs($actor)->delete("/admin/organisasi/jabatan/{$position->id}")->assertForbidden();
    $this->actingAs($actor)->post("/admin/organisasi/jabatan/{$position->id}/pulihkan")->assertForbidden();
})->with([Role::Direksi, Role::KepalaDivisi, Role::Anggota]);
