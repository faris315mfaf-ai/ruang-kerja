<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('creates exactly one private personal workspace per employee', function () {
    $user = User::factory()->create(['name' => 'Dimas Pratama']);

    $again = app(EnsurePersonalWorkspace::class)->handle($user);
    $workspaces = Workspace::query()->where('type', 'personal')->where('owner_id', $user->id)->get();

    expect($workspaces)->toHaveCount(1)
        ->and($again->is($workspaces->first()))->toBeTrue()
        ->and($again->name)->toBe('Pribadi')
        ->and($again->key)->toBe('DP')
        ->and($again->visibility->value)->toBe('private')
        ->and($again->roleOf($user))->toBe(WorkspaceRole::Owner)
        ->and($again->statuses()->pluck('category')->map->value->all())->toBe(['backlog', 'todo', 'in_progress', 'review', 'done']);
});

it('derives unique keys', function () {
    User::factory()->create(['name' => 'Dimas Pratama']);
    $twin = User::factory()->create(['name' => 'Dewi Purnama']);

    expect(Workspace::query()->where('owner_id', $twin->id)->value('key'))->toBe('DP2')
        ->and(WorkspaceKeyGenerator::fromName('Proyek Peluncuran Q4'))->toBe('PQ')
        ->and(WorkspaceKeyGenerator::fromName('Gudang'))->toBe('GUD')
        ->and(WorkspaceKeyGenerator::fromName('Tim 7'))->toBe('WS')
        ->and(WorkspaceKeyGenerator::isValid('OPS'))->toBeTrue()
        ->and(WorkspaceKeyGenerator::isValid('O'))->toBeFalse();
});

it('answers 404 to everyone but the owner, including Super Admin', function () {
    $owner = User::factory()->create();
    $personal = Workspace::query()->where('owner_id', $owner->id)->firstOrFail();

    foreach ([Role::SuperAdmin, Role::Direksi, Role::Hr, Role::KepalaDivisi] as $role) {
        $this->actingAs(User::factory()->withRole($role)->create())
            ->get("/w/{$personal->key}")
            ->assertNotFound();
    }

    $this->actingAs($owner)->get("/w/{$personal->key}")->assertOk();
});

it('lists the personal workspace in the shared sidebar prop of its owner only', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $personal = Workspace::query()->where('owner_id', $owner->id)->firstOrFail();

    $this->actingAs($owner)->get('/dashboard')
        ->assertInertia(fn ($page) => $page->where('workspaces.0.id', $personal->id)->where('workspaces.0.type', 'personal'));

    $this->actingAs($other)->get('/dashboard')
        ->assertInertia(fn ($page) => $page->where('workspaces', fn ($list) => collect($list)->pluck('id')->doesntContain($personal->id)));
});

it('purges the personal workspace when the employee is deleted', function () {
    $user = User::factory()->create();
    $id = Workspace::query()->where('owner_id', $user->id)->value('id');

    $user->delete();

    expect(Workspace::withTrashed()->find($id))->toBeNull();
});
