<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Search\Providers\TaskSearchProvider;
use App\Domain\Search\Providers\WorkspaceSearchProvider;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->project = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
    $this->member = memberWithRole($this->project, WorkspaceRole::Member);
    app(CreateTask::class)->handle($this->project, $this->owner, ['title' => 'Landing page produk baru']);
});

it('finds tasks by title and by KEY-n, only in visible workspaces', function () {
    $provider = app(TaskSearchProvider::class);
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->owner->id)->firstOrFail();
    app(CreateTask::class)->handle($personal, $this->owner, ['title' => 'Landing pribadi rahasia']);

    expect(collect($provider->search($this->member, 'landing', 10))->pluck('code')->all())->toBe(['PLQ-1'])
        ->and(collect($provider->search($this->member, 'plq-1', 10))->pluck('title')->all())->toBe(['Landing page produk baru'])
        ->and($provider->search(User::factory()->withRole(Role::SuperAdmin)->create(), 'rahasia', 10))->toBe([])
        ->and(collect($provider->search($this->owner, 'rahasia', 10))->pluck('subtitle')->all())->toBe(['Pribadi'])
        ->and($provider->search(User::factory()->create(), 'landing', 10))->toBe([]);
});

it('finds workspaces by name or key for those who may see them', function () {
    $provider = app(WorkspaceSearchProvider::class);

    expect(collect($provider->search($this->member, 'peluncuran', 10))->pluck('url')->all())->toBe(['/w/PLQ'])
        ->and(collect($provider->search($this->member, 'plq', 10))->pluck('code')->all())->toBe(['PLQ'])
        ->and($provider->search(User::factory()->create(), 'peluncuran', 10))->toBe([])
        ->and(collect($provider->search(User::factory()->withRole(Role::Direksi)->create(), 'peluncuran', 10))->pluck('code')->all())->toBe(['PLQ']);
});

it('is wired into the search endpoint', function () {
    $this->actingAs($this->member)
        ->getJson('/cari/hasil?q=landing')
        ->assertOk()
        ->assertJsonPath('groups.0.key', 'tasks');
});
