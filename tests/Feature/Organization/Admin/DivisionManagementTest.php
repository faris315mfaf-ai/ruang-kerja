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

dataset('managers', [
    'super_admin' => [Role::SuperAdmin],
    'hr' => [Role::Hr],
]);

dataset('non-managers', [
    'direksi' => [Role::Direksi],
    'kepala_divisi' => [Role::KepalaDivisi],
    'anggota' => [Role::Anggota],
]);

it('lists divisions with counts for HR and Super Admin', function (Role $role) {
    $actor = User::factory()->withRole($role)->create();
    $head = User::factory()->create(['name' => 'Agus Setiawan']);
    $division = Division::factory()->headedBy($head)->create(['name' => 'Keuangan', 'code' => 'KEU']);
    User::factory()->count(2)->inDivision($division)->create();
    User::factory()->inactive()->inDivision($division)->create();
    Team::factory()->for($division)->create();

    $this->actingAs($actor)
        ->get('/admin/organisasi/divisi')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/organization/index')
            ->where('tab', 'divisi')
            ->where('showDeleted', false)
            ->has('divisions', 1)
            ->where('divisions.0.code', 'KEU')
            ->where('divisions.0.head.name', 'Agus Setiawan')
            ->where('divisions.0.membersCount', 2)
            ->where('divisions.0.teamsCount', 1)
            ->where('counts.divisions', 1)
            ->has('options.users')
            ->has('options.levels', 5),
        );
})->with('managers');

it('redirects the organization root to the division tab', function () {
    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->get('/admin/organisasi')
        ->assertRedirect('/admin/organisasi/divisi');
});

it('forbids the admin pages and writes to other roles', function (Role $role) {
    $actor = User::factory()->withRole($role)->create();
    $division = Division::factory()->create();

    $this->actingAs($actor)->get('/admin/organisasi/divisi')->assertForbidden();
    $this->actingAs($actor)->get('/admin/organisasi/tim')->assertForbidden();
    $this->actingAs($actor)->get('/admin/organisasi/jabatan')->assertForbidden();
    $this->actingAs($actor)->post('/admin/organisasi/divisi', ['name' => 'Legal', 'code' => 'LGL'])->assertForbidden();
    $this->actingAs($actor)->post('/admin/organisasi/divisi', ['name' => '', 'code' => $division->code])->assertForbidden();
    $this->actingAs($actor)->put("/admin/organisasi/divisi/{$division->id}", ['name' => 'X', 'code' => 'X1'])->assertForbidden();
    $this->actingAs($actor)->delete("/admin/organisasi/divisi/{$division->id}")->assertForbidden();

    expect(Division::query()->count())->toBe(1)
        ->and($division->fresh()?->trashed())->toBeFalse();
})->with('non-managers');

it('requires authentication', function () {
    $this->get('/admin/organisasi/divisi')->assertRedirect(route('login'));
});

it('creates a division with an upper-cased code and audits it', function (Role $role) {
    $actor = User::factory()->withRole($role)->create();
    $head = User::factory()->create();

    $this->actingAs($actor)
        ->from('/admin/organisasi/divisi')
        ->post('/admin/organisasi/divisi', [
            'name' => 'Legal',
            'code' => ' lgl ',
            'head_user_id' => $head->id,
        ])
        ->assertRedirect('/admin/organisasi/divisi')
        ->assertSessionHasNoErrors();

    $division = Division::query()->where('name', 'Legal')->firstOrFail();

    expect($division->code)->toBe('LGL')
        ->and($division->company_id)->toBe($actor->company_id)
        ->and($division->head_user_id)->toBe($head->id)
        ->and($division->is_board)->toBeFalse();

    $log = AuditLog::query()->where('action', 'division.created')->sole();
    expect($log->user_id)->toBe($actor->id)
        ->and($log->auditable_id)->toBe($division->id)
        ->and($log->new_values['code'] ?? null)->toBe('LGL');
})->with('managers');

it('validates division codes', function (array $input, string $field, string $message) {
    Division::factory()->create(['code' => 'KEU']);
    Division::factory()->create(['code' => 'OLD'])->delete();

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->post('/admin/organisasi/divisi', [...['name' => 'Divisi Baru', 'code' => 'BARU'], ...$input])
        ->assertSessionHasErrors([$field => $message]);
})->with([
    'missing' => [['code' => ''], 'code', 'Kode divisi wajib diisi.'],
    'too long' => [['code' => 'ABCDEFGHIJK'], 'code', 'Kode divisi maksimal 10 karakter.'],
    'spaces' => [['code' => 'KE U'], 'code', 'Kode divisi hanya boleh berisi huruf dan angka, tanpa spasi.'],
    'symbols' => [['code' => 'KE-U'], 'code', 'Kode divisi hanya boleh berisi huruf dan angka, tanpa spasi.'],
    'duplicate (case-insensitive)' => [['code' => 'keu'], 'code', 'Kode KEU sudah dipakai divisi lain (termasuk yang sudah dihapus).'],
    'used by a deleted division' => [['code' => 'OLD'], 'code', 'Kode OLD sudah dipakai divisi lain (termasuk yang sudah dihapus).'],
    'missing name' => [['name' => ''], 'name', 'Nama divisi wajib diisi.'],
]);

it('accepts a code that only another company uses', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    Division::factory()->forCompany(Company::factory()->create())->create(['code' => 'KEU']);

    $this->actingAs($hr)
        ->post('/admin/organisasi/divisi', ['name' => 'Keuangan', 'code' => 'KEU'])
        ->assertSessionHasNoErrors();

    expect(Division::query()->where('code', 'KEU')->count())->toBe(2);
});

it('keeps its own code when updating', function () {
    $division = Division::factory()->create(['name' => 'Keuangan', 'code' => 'KEU']);

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->put("/admin/organisasi/divisi/{$division->id}", ['name' => 'Keuangan & Pajak', 'code' => 'KEU'])
        ->assertSessionHasNoErrors();

    expect($division->fresh()?->name)->toBe('Keuangan & Pajak');
    expect(AuditLog::query()->where('action', 'division.updated')->sole()->new_values)->toBe(['name' => 'Keuangan & Pajak']);
});

it('allows only one board unit, without a parent', function () {
    $board = Division::factory()->board()->create();
    $other = Division::factory()->create();
    $hr = User::factory()->withRole(Role::Hr)->create();

    $this->actingAs($hr)
        ->post('/admin/organisasi/divisi', ['name' => 'Dewan', 'code' => 'DWN', 'is_board' => true])
        ->assertSessionHasErrors(['is_board' => 'Unit Direksi sudah ada (Direksi). Hanya boleh ada satu unit Direksi.']);

    $this->actingAs($hr)
        ->put("/admin/organisasi/divisi/{$board->id}", ['name' => 'Direksi', 'code' => 'DIR', 'is_board' => true, 'parent_id' => $other->id])
        ->assertSessionHasErrors(['parent_id' => 'Unit Direksi berada di puncak bagan dan tidak boleh memiliki induk.']);

    // Updating the board itself is fine.
    $this->actingAs($hr)
        ->put("/admin/organisasi/divisi/{$board->id}", ['name' => 'Dewan Direksi', 'code' => 'DIR', 'is_board' => true])
        ->assertSessionHasNoErrors();
});

it('prevents parent cycles between divisions', function () {
    $parent = Division::factory()->create(['code' => 'OPS']);
    $child = Division::factory()->childOf($parent)->create(['code' => 'GDG']);
    $hr = User::factory()->withRole(Role::Hr)->create();

    $this->actingAs($hr)
        ->put("/admin/organisasi/divisi/{$parent->id}", ['name' => $parent->name, 'code' => 'OPS', 'parent_id' => $child->id])
        ->assertSessionHasErrors(['parent_id' => 'Induk divisi tidak boleh divisi ini sendiri atau sub-divisinya.']);

    $this->actingAs($hr)
        ->put("/admin/organisasi/divisi/{$parent->id}", ['name' => $parent->name, 'code' => 'OPS', 'parent_id' => $parent->id])
        ->assertSessionHasErrors('parent_id');
});

it('rejects heads that are inactive or from another company', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $inactive = User::factory()->inactive()->create();
    $stranger = User::factory()->forCompany(Company::factory()->create())->create();

    foreach ([$inactive, $stranger] as $head) {
        $this->actingAs($hr)
            ->post('/admin/organisasi/divisi', ['name' => 'Legal', 'code' => 'LGL', 'head_user_id' => $head->id])
            ->assertSessionHasErrors(['head_user_id' => 'Kepala divisi harus karyawan aktif di perusahaan ini.']);
    }
});

it('refuses to delete a division that still has active members, teams or sub-divisions', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $division = Division::factory()->create(['name' => 'Operasional']);
    User::factory()->count(2)->inDivision($division)->create();
    Team::factory()->for($division)->create();
    Division::factory()->childOf($division)->create();

    $this->actingAs($hr)
        ->delete("/admin/organisasi/divisi/{$division->id}")
        ->assertSessionHasErrors(['division' => 'Divisi Operasional masih memiliki 2 karyawan aktif, 1 tim, dan 1 sub-divisi. Pindahkan atau hapus terlebih dahulu.']);

    expect($division->fresh()?->trashed())->toBeFalse()
        ->and(AuditLog::query()->where('action', 'division.deleted')->exists())->toBeFalse();
});

it('soft-deletes an empty division and lets it be restored', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $division = Division::factory()->create(['name' => 'Legal']);
    // Former employees keep their historical division and do not block deletion.
    $former = User::factory()->resigned()->inDivision($division)->create();

    $this->actingAs($hr)->delete("/admin/organisasi/divisi/{$division->id}")->assertSessionHasNoErrors();

    expect(Division::withTrashed()->find($division->id)?->trashed())->toBeTrue()
        ->and($former->fresh()?->division_id)->toBe($division->id)
        ->and(AuditLog::query()->where('action', 'division.deleted')->sole()->auditable_id)->toBe($division->id);

    $this->actingAs($hr)
        ->get('/admin/organisasi/divisi?terhapus=1')
        ->assertInertia(fn (Assert $page) => $page
            ->where('showDeleted', true)
            ->where('divisions', fn ($rows) => collect($rows)->contains(fn ($row) => $row['id'] === $division->id && $row['deletedAt'] !== null)),
        );

    $this->actingAs($hr)->post("/admin/organisasi/divisi/{$division->id}/pulihkan")->assertSessionHasNoErrors();

    expect($division->fresh()?->trashed())->toBeFalse()
        ->and(AuditLog::query()->where('action', 'division.restored')->exists())->toBeTrue();
});

it('hides deleted divisions by default', function () {
    Division::factory()->create(['code' => 'OLD'])->delete();

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->get('/admin/organisasi/divisi')
        ->assertInertia(fn (Assert $page) => $page->has('divisions', 0));
});

it('refuses to restore a second board unit', function () {
    $old = Division::factory()->board()->create(['code' => 'DIR']);
    $old->delete();
    Division::factory()->create(['name' => 'Direksi Baru', 'code' => 'DRB', 'is_board' => true]);

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->post("/admin/organisasi/divisi/{$old->id}/pulihkan")
        ->assertSessionHasErrors('division');

    expect($old->fresh()?->trashed())->toBeTrue();
});

it('forbids changing divisions of another company', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $foreign = Division::factory()->forCompany(Company::factory()->create())->create();

    $this->actingAs($hr)->put("/admin/organisasi/divisi/{$foreign->id}", ['name' => 'X', 'code' => 'XX'])->assertForbidden();
    // Authorization runs before validation: invalid input still yields 403.
    $this->actingAs($hr)->put("/admin/organisasi/divisi/{$foreign->id}", ['name' => '', 'code' => ''])->assertForbidden();
    $this->actingAs($hr)->delete("/admin/organisasi/divisi/{$foreign->id}")->assertForbidden();
    $this->actingAs($hr)->post("/admin/organisasi/divisi/{$foreign->id}/pulihkan")->assertForbidden();
});

it('keeps an already-inactive head on unrelated edits but rejects switching to an inactive head', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $staleHead = User::factory()->forCompany($hr->company)->inactive()->create();
    $division = Division::factory()->forCompany($hr->company)->create(['name' => 'Legal', 'code' => 'LGL', 'head_user_id' => $staleHead->id]);

    $this->actingAs($hr)
        ->put("/admin/organisasi/divisi/{$division->id}", ['name' => 'Legal & Kepatuhan', 'code' => 'LGL', 'head_user_id' => $staleHead->id])
        ->assertSessionHasNoErrors();

    expect($division->refresh()->name)->toBe('Legal & Kepatuhan');

    $otherInactive = User::factory()->forCompany($hr->company)->inactive()->create();

    $this->actingAs($hr)
        ->put("/admin/organisasi/divisi/{$division->id}", ['name' => 'Legal', 'code' => 'LGL', 'head_user_id' => $otherInactive->id])
        ->assertSessionHasErrors(['head_user_id' => 'Kepala divisi harus karyawan aktif di perusahaan ini.']);
});
