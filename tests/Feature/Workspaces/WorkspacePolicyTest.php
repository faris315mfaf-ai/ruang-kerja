<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Division;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\TaskPolicy;
use App\Policies\WorkspacePolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Role × action matrices for WorkspacePolicy / TaskPolicy (docs/ARCHITECTURE.md §4).
 * Actors: workspace owner/admin/member/viewer, an unrelated employee, Super
 * Admin, Direksi, HR and an unrelated Kepala Divisi (all non-members).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->actors = [
        'owner' => User::factory()->withRole(Role::KepalaDivisi)->create(),
        'admin' => User::factory()->withRole(Role::Anggota)->create(),
        'member' => User::factory()->withRole(Role::Anggota)->create(),
        'viewer' => User::factory()->withRole(Role::Anggota)->create(),
        'outsider' => User::factory()->withRole(Role::Anggota)->create(),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'hr' => User::factory()->withRole(Role::Hr)->create(),
        'kadiv' => User::factory()->withRole(Role::KepalaDivisi)->create(),
    ];

    $owner = $this->actors['owner'];
    $this->workspaces = [
        // Created automatically by the User::created hook.
        'personal' => Workspace::query()->where('type', 'personal')->where('owner_id', $owner->id)->firstOrFail(),
        'private' => Workspace::factory()->ownedBy($owner)->create(),
        'internal' => Workspace::factory()->ownedBy($owner)->internal()->create(),
        'archived' => Workspace::factory()->ownedBy($owner)->archived()->create(),
    ];

    foreach (['private', 'internal', 'archived'] as $key) {
        addMember($this->workspaces[$key], $this->actors['admin'], WorkspaceRole::Admin);
        addMember($this->workspaces[$key], $this->actors['member'], WorkspaceRole::Member);
        addMember($this->workspaces[$key], $this->actors['viewer'], WorkspaceRole::Viewer);
    }
});

$members = ['owner', 'admin', 'member', 'viewer'];
$everyone = ['owner', 'admin', 'member', 'viewer', 'outsider', 'super_admin', 'direksi', 'hr', 'kadiv'];

dataset('workspace matrix', [
    // [ability, workspace, actors allowed]
    ['view', 'personal', ['owner']],
    ['view', 'private', [...$members, 'super_admin', 'direksi']],
    ['view', 'internal', $everyone],
    ['view', 'archived', [...$members, 'super_admin', 'direksi']],
    ['editTasks', 'personal', ['owner']],
    ['editTasks', 'private', ['owner', 'admin', 'member']],
    ['editTasks', 'internal', ['owner', 'admin', 'member']],
    ['editTasks', 'archived', []],
    ['update', 'personal', ['owner']],
    ['update', 'private', ['owner', 'admin', 'super_admin']],
    ['update', 'internal', ['owner', 'admin', 'super_admin']],
    ['update', 'archived', []],
    ['manageMembers', 'personal', []],
    ['manageMembers', 'private', ['owner', 'admin', 'super_admin']],
    ['archive', 'personal', []],
    ['archive', 'private', ['owner', 'super_admin']],
    ['archive', 'archived', ['owner', 'super_admin']],
    ['favorite', 'personal', ['owner']],
    ['favorite', 'private', $members],
]);

it('applies the workspace role matrix', function (string $ability, string $workspace, array $allowed) {
    $subject = $this->workspaces[$workspace];

    foreach ($this->actors as $name => $actor) {
        $response = Gate::forUser($actor)->inspect($ability, $subject);
        $expected = in_array($name, $allowed, true);

        expect($response->allowed())->toBe($expected, "{$name} → {$ability} on {$workspace}");

        if (! $expected) {
            // Hidden workspaces answer 404, visible-but-forbidden ones 403.
            $visible = Gate::forUser($actor)->allows('view', $subject);
            expect($response->status())->toBe($visible ? null : 404, "{$name} status on {$workspace}");
        }
    }
})->with('workspace matrix');

it('keeps personal workspaces closed even to Super Admin and Direksi', function () {
    $personal = $this->workspaces['personal'];

    foreach (['super_admin', 'direksi', 'hr', 'kadiv'] as $name) {
        expect(Gate::forUser($this->actors[$name])->inspect('view', $personal)->status())->toBe(404)
            ->and(Workspace::query()->visibleTo($this->actors[$name])->whereKey($personal->id)->exists())->toBeFalse();
    }
});

it('matches visibleTo() with the view ability for every actor', function () {
    foreach ($this->actors as $name => $actor) {
        foreach ($this->workspaces as $key => $workspace) {
            $listed = Workspace::query()->visibleTo($actor)->whereKey($workspace->id)->exists();

            expect($listed)->toBe(Gate::forUser($actor)->allows('view', $workspace), "{$name} / {$key}");
        }
    }
});

it('lets a Kepala Divisi read projects that involve their division', function () {
    $division = Division::factory()->create();
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($division)->create();
    $staff = User::factory()->inDivision($division)->create();
    $project = $this->workspaces['private'];

    expect(Gate::forUser($kadiv)->allows('view', $project))->toBeFalse();

    addMember($project, $staff);

    expect(Gate::forUser($kadiv)->allows('view', $project))->toBeTrue()
        ->and(Workspace::query()->visibleTo($kadiv)->whereKey($project->id)->exists())->toBeTrue()
        ->and(Gate::forUser($kadiv)->allows('editTasks', $project))->toBeFalse();
});

it('controls who may create team and project workspaces', function () {
    $lead = User::factory()->withRole(Role::Anggota)->create();
    Team::factory()->ledBy($lead)->create();

    $can = fn (User $user, WorkspaceType $type) => Gate::forUser($user)->allows('create', [Workspace::class, $type]);

    expect($can($this->actors['kadiv'], WorkspaceType::Team))->toBeTrue()
        ->and($can($this->actors['kadiv'], WorkspaceType::Project))->toBeTrue()
        ->and($can($lead, WorkspaceType::Team))->toBeTrue()
        ->and($can($this->actors['super_admin'], WorkspaceType::Project))->toBeTrue()
        ->and($can($this->actors['direksi'], WorkspaceType::Project))->toBeTrue()
        ->and($can($this->actors['direksi'], WorkspaceType::Team))->toBeFalse()
        ->and($can($this->actors['outsider'], WorkspaceType::Team))->toBeFalse()
        ->and($can($this->actors['outsider'], WorkspaceType::Project))->toBeFalse()
        ->and($can($this->actors['hr'], WorkspaceType::Project))->toBeFalse()
        ->and($can($this->actors['super_admin'], WorkspaceType::Personal))->toBeFalse()
        ->and($can($this->actors['super_admin'], WorkspaceType::Division))->toBeFalse();
});

it('is auto-discovered for workspaces and tasks', function () {
    expect(Gate::getPolicyFor(Workspace::class))->toBeInstanceOf(WorkspacePolicy::class)
        ->and(Gate::getPolicyFor(Task::class))->toBeInstanceOf(TaskPolicy::class);
});

dataset('task matrix', [
    ['view', 'private', [...$members, 'super_admin', 'direksi']],
    ['update', 'private', ['owner', 'admin', 'member']],
    ['move', 'private', ['owner', 'admin', 'member']],
    ['move', 'internal', ['owner', 'admin', 'member']],
    ['move', 'archived', []],
    ['delete', 'private', ['owner', 'admin', 'member']],
]);

it('applies the task role matrix', function (string $ability, string $workspace, array $allowed) {
    $task = Task::factory()->create([
        'workspace_id' => $this->workspaces[$workspace]->id,
        'created_by' => $this->actors['member']->id,
    ]);

    foreach ($this->actors as $name => $actor) {
        expect(Gate::forUser($actor)->allows($ability, $task))->toBe(in_array($name, $allowed, true), "{$name} → {$ability}");
    }
})->with('task matrix');

it('lets only the creator or an admin delete a task', function () {
    $workspace = $this->workspaces['private'];
    $task = Task::factory()->create(['workspace_id' => $workspace->id, 'created_by' => $this->actors['admin']->id]);

    expect(Gate::forUser($this->actors['member'])->inspect('delete', $task)->status())->toBe(null)
        ->and(Gate::forUser($this->actors['member'])->allows('delete', $task))->toBeFalse()
        ->and(Gate::forUser($this->actors['owner'])->allows('delete', $task))->toBeTrue()
        ->and(Gate::forUser($this->actors['admin'])->allows('delete', $task))->toBeTrue();
});
