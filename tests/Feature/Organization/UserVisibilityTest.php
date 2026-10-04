<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->ops = Division::factory()->create(['code' => 'OPS']);
    $this->keu = Division::factory()->create(['code' => 'KEU']);
    $this->opsSub = Division::factory()->childOf($this->ops)->create(['code' => 'GDG']);

    $this->director = User::factory()->withRole(Role::Direksi)->create();
    $this->kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($this->ops)->managedBy($this->director)->create();
    $this->ops->update(['head_user_id' => $this->kadiv->id]);
    $this->member = User::factory()->withRole(Role::Anggota)->inDivision($this->ops)->managedBy($this->kadiv)->create();
    $this->warehouse = User::factory()->withRole(Role::Anggota)->inDivision($this->opsSub)->managedBy($this->member)->create();
    $this->finance = User::factory()->withRole(Role::Anggota)->inDivision($this->keu)->create();
    $this->hr = User::factory()->withRole(Role::Hr)->create();
    $this->admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $this->outsider = User::factory()->forCompany(Company::factory()->create())->withRole(Role::Anggota)->create();
});

function visibleIds(User $viewer): array
{
    return User::query()->visibleTo($viewer)->pluck('id')->sort()->values()->all();
}

function idsOf(User ...$users): array
{
    return collect($users)->pluck('id')->sort()->values()->all();
}

it('shows everyone in the company to HR, Direksi and Super Admin', function (string $viewer) {
    $all = idsOf($this->director, $this->kadiv, $this->member, $this->warehouse, $this->finance, $this->hr, $this->admin);

    expect(visibleIds($this->{$viewer}))->toBe($all);
})->with(['hr', 'director', 'admin']);

it('shows an anggota only themselves and their direct reports', function () {
    expect(visibleIds($this->finance))->toBe(idsOf($this->finance))
        ->and(visibleIds($this->member))->toBe(idsOf($this->member, $this->warehouse));
});

it('shows a kepala divisi their whole division including sub-divisions', function () {
    expect(visibleIds($this->kadiv))->toBe(idsOf($this->kadiv, $this->member, $this->warehouse));
});

it('treats the division head column as leading the division even without the role', function () {
    $head = User::factory()->withRole(Role::Anggota)->create();
    $this->keu->update(['head_user_id' => $head->id]);

    expect(visibleIds($head))->toBe(idsOf($head, $this->finance));
});

it('does not give a kepala divisi other divisions', function () {
    expect(visibleIds($this->kadiv))->not->toContain($this->finance->id);
});

it('never leaks users of another company', function () {
    expect(visibleIds($this->hr))->not->toContain($this->outsider->id)
        ->and(visibleIds($this->outsider))->toBe(idsOf($this->outsider));
});

it('filters active users', function () {
    User::factory()->inactive()->create();

    expect(User::query()->active()->where('status', '!=', 'active')->exists())->toBeFalse();
});
