<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\TaskPlan;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';
require_once __DIR__.'/planner-helpers.php';

/*
 * Ruang saya authorization. TaskPolicy::plan — actor × task: a task assigned
 * to `anggota` in an internal project and a note in anggota's personal
 * workspace. TaskPlanPolicy — a plan is private to its owner, whatever the
 * role. 'allow' · 'deny' (403) · 'hidden' (404).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->lead = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->anggota = User::factory()->withRole(Role::Anggota)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->lead)->create(['key' => 'PLQ', 'visibility' => WorkspaceVisibility::Internal]);
    addMember($this->workspace, $this->anggota);
    $this->assigned = assignTask($this->workspace, $this->lead, $this->anggota, 'Landing page');
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->anggota->id)->firstOrFail();
    $this->note = selfTask($personal, $this->anggota, 'Perpanjang SIM');
    $this->plan = TaskPlan::factory()->for($this->anggota)->for($this->assigned)->in(PlanBucket::Today)->create();
});

function plannerActor(string $actor): User
{
    return match ($actor) {
        'anggota' => test()->anggota,
        'lead' => test()->lead,
        'member' => memberWithRole(test()->workspace, WorkspaceRole::Member),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'hr' => User::factory()->withRole(Role::Hr)->create(),
        'kadiv' => User::factory()->withRole(Role::KepalaDivisi)->create(),
    };
}

function plannerVerdict(User $user, string $ability, mixed $arguments): string
{
    $response = Gate::forUser($user)->inspect($ability, $arguments);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

it('lets only the assignee or the personal owner plan a task', function (string $actor, string $assigned, string $note) {
    $user = plannerActor($actor);

    expect([
        plannerVerdict($user, 'plan', $this->assigned),
        plannerVerdict($user, 'plan', $this->note),
    ])->toBe([$assigned, $note]);
})->with([
    //               assigned  personal note
    'anggota' => ['anggota', 'allow', 'allow'],
    'workspace owner' => ['lead', 'deny', 'hidden'],
    'other member' => ['member', 'deny', 'hidden'],
    'super_admin' => ['super_admin', 'deny', 'hidden'],
    'direksi' => ['direksi', 'deny', 'hidden'],
    'hr' => ['hr', 'deny', 'hidden'],
    'kadiv' => ['kadiv', 'deny', 'hidden'],
]);

it('keeps a plan private to its owner', function (string $actor, bool $expected) {
    $user = plannerActor($actor);

    expect([
        Gate::forUser($user)->allows('view', $this->plan),
        Gate::forUser($user)->allows('update', $this->plan),
        Gate::forUser($user)->allows('delete', $this->plan),
    ])->toBe([$expected, $expected, $expected]);
})->with([
    'anggota (owner)' => ['anggota', true],
    'workspace owner' => ['lead', false],
    'other member' => ['member', false],
    'super_admin' => ['super_admin', false],
    'direksi' => ['direksi', false],
    'hr' => ['hr', false],
    'kadiv' => ['kadiv', false],
]);

it('never serves another user\'s planner', function () {
    foreach (['lead', 'super_admin', 'direksi', 'hr'] as $actor) {
        $planner = $this->actingAs(plannerActor($actor))->getJson('/ruang-saya')->assertOk()->json('planner');
        $ids = collect($planner['lanes'])->flatten(1)->pluck('id')->merge(collect($planner['incoming'])->pluck('id'));

        expect($ids)->not->toContain($this->note->id)
            ->and($ids)->not->toContain($this->assigned->id);
    }
});
