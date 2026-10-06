<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Company;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Policy matrices of F2-4. 'allow' · 'deny' (403) · 'hidden' (404).
 * Decision Oct 2026: rules, recurring tasks and workspace templates belong to
 * the workspace — no global role (Direksi, HR, Super Admin) reads them unless
 * it is a member.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'type' => WorkspaceType::Team]);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
});

function automationActor(string $actor): User
{
    return match ($actor) {
        'owner' => test()->owner,
        'member' => test()->member,
        'admin' => memberWithRole(test()->workspace, WorkspaceRole::Admin),
        'viewer' => memberWithRole(test()->workspace, WorkspaceRole::Viewer),
        'kadiv' => User::factory()->withRole(Role::KepalaDivisi)->create(),
        'hr' => User::factory()->withRole(Role::Hr)->create(),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'anggota' => User::factory()->withRole(Role::Anggota)->create(),
        'foreign' => User::factory()->withRole(Role::KepalaDivisi)->create(['company_id' => Company::factory()->create()->id]),
        'inactive_member' => addMember(test()->workspace, User::factory()->inactive()->create(), WorkspaceRole::Admin),
    };
}

function automationVerdict(User $user, string $ability, mixed $arguments): string
{
    $response = Gate::forUser($user)->inspect($ability, $arguments);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

it('applies the automation rule matrix', function (string $actor, string $view, string $create, string $update, string $delete) {
    $rule = AutomationRule::factory()->forWorkspace($this->workspace)->create();
    $user = automationActor($actor);

    expect([
        automationVerdict($user, 'view', $rule),
        automationVerdict($user, 'create', [AutomationRule::class, $this->workspace]),
        automationVerdict($user, 'update', $rule),
        automationVerdict($user, 'delete', $rule),
    ])->toBe([$view, $create, $update, $delete]);
})->with([
    //                     view     create   update   delete
    'owner' => ['owner', 'allow', 'allow', 'allow', 'allow'],
    'admin' => ['admin', 'allow', 'allow', 'allow', 'allow'],
    'member' => ['member', 'allow', 'deny', 'deny', 'deny'],
    'viewer' => ['viewer', 'allow', 'deny', 'deny', 'deny'],
    'kadiv (not a member)' => ['kadiv', 'hidden', 'hidden', 'hidden', 'hidden'],
    'hr' => ['hr', 'hidden', 'hidden', 'hidden', 'hidden'],
    'direksi' => ['direksi', 'hidden', 'hidden', 'hidden', 'hidden'],
    'super admin' => ['super_admin', 'hidden', 'hidden', 'hidden', 'hidden'],
    'anggota' => ['anggota', 'hidden', 'hidden', 'hidden', 'hidden'],
    'other company' => ['foreign', 'hidden', 'hidden', 'hidden', 'hidden'],
    'inactive admin' => ['inactive_member', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('makes archived workspaces read-only for rules', function () {
    $rule = AutomationRule::factory()->forWorkspace($this->workspace)->create();
    $this->workspace->update(['archived_at' => now()]);

    expect(automationVerdict($this->owner, 'view', $rule->fresh()))->toBe('allow')
        ->and(automationVerdict($this->owner, 'update', $rule->fresh()))->toBe('deny');
});

it('lets the run log follow its rule', function () {
    $rule = AutomationRule::factory()->forWorkspace($this->workspace)->create();
    $task = Task::factory()->create(['workspace_id' => $this->workspace->id]);
    $run = AutomationRun::query()->create([
        'rule_id' => $rule->id, 'task_id' => $task->id, 'task_key' => 'OPS-1', 'task_title' => 'x',
        'result' => 'success', 'detail' => 'ok', 'ran_at' => now(),
    ]);

    expect(automationVerdict($this->member, 'view', $run))->toBe('allow')
        ->and(automationVerdict(automationActor('hr'), 'view', $run))->toBe('hidden');
});

it('applies the recurring task matrix', function (string $actor, string $view, string $create, string $update, string $run) {
    $recurring = RecurringTask::factory()->forWorkspace($this->workspace)->create();
    $user = automationActor($actor);

    expect([
        automationVerdict($user, 'view', $recurring),
        automationVerdict($user, 'create', [RecurringTask::class, $this->workspace]),
        automationVerdict($user, 'update', $recurring),
        automationVerdict($user, 'run', $recurring),
    ])->toBe([$view, $create, $update, $run]);
})->with([
    //                     view     create   update   run
    'owner (creator)' => ['owner', 'allow', 'allow', 'allow', 'allow'],
    'admin' => ['admin', 'allow', 'allow', 'allow', 'allow'],
    'member (not creator)' => ['member', 'allow', 'allow', 'deny', 'deny'],
    'viewer' => ['viewer', 'allow', 'deny', 'deny', 'deny'],
    'kadiv (not a member)' => ['kadiv', 'hidden', 'hidden', 'hidden', 'hidden'],
    'hr' => ['hr', 'hidden', 'hidden', 'hidden', 'hidden'],
    'direksi' => ['direksi', 'hidden', 'hidden', 'hidden', 'hidden'],
    'super admin' => ['super_admin', 'hidden', 'hidden', 'hidden', 'hidden'],
    'other company' => ['foreign', 'hidden', 'hidden', 'hidden', 'hidden'],
    'inactive admin' => ['inactive_member', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('lets a member manage the recurring task they created', function () {
    $recurring = RecurringTask::factory()->forWorkspace($this->workspace)->create(['created_by' => $this->member->id]);

    expect(automationVerdict($this->member, 'update', $recurring))->toBe('allow')
        ->and(automationVerdict($this->member, 'delete', $recurring))->toBe('allow');

    // Demoted to viewer: no longer.
    addMember($this->workspace, $this->member, WorkspaceRole::Viewer);
    expect(automationVerdict($this->member, 'update', $recurring->fresh()))->toBe('deny');
});

it('applies the task template matrix', function (string $actor, string $viewCompany, string $viewWorkspace, string $createCompany, string $createWorkspace, string $useCompany) {
    $company = TaskTemplate::factory()->create(['created_by' => $this->owner->id]);
    $scoped = TaskTemplate::factory()->forWorkspace($this->workspace)->create();
    $user = automationActor($actor);

    expect([
        automationVerdict($user, 'view', $company),
        automationVerdict($user, 'view', $scoped),
        automationVerdict($user, 'create', [TaskTemplate::class, null]),
        automationVerdict($user, 'create', [TaskTemplate::class, $this->workspace]),
        automationVerdict($user, 'use', [$company, $this->workspace]),
    ])->toBe([$viewCompany, $viewWorkspace, $createCompany, $createWorkspace, $useCompany]);
})->with([
    //                     view co  view ws  new co   new ws   use co in OPS
    'owner (kadiv)' => ['owner', 'allow', 'allow', 'allow', 'allow', 'allow'],
    'admin' => ['admin', 'allow', 'allow', 'deny', 'allow', 'allow'],
    'member' => ['member', 'allow', 'allow', 'deny', 'deny', 'allow'],
    'viewer' => ['viewer', 'allow', 'allow', 'deny', 'deny', 'deny'],
    'hr' => ['hr', 'allow', 'hidden', 'deny', 'hidden', 'hidden'],
    'direksi' => ['direksi', 'allow', 'hidden', 'allow', 'hidden', 'hidden'],
    'super admin' => ['super_admin', 'allow', 'hidden', 'allow', 'hidden', 'hidden'],
    'other company' => ['foreign', 'hidden', 'hidden', 'allow', 'hidden', 'hidden'],
    'inactive admin' => ['inactive_member', 'hidden', 'hidden', 'deny', 'hidden', 'hidden'],
]);

it('keeps a workspace task template inside its workspace', function () {
    $scoped = TaskTemplate::factory()->forWorkspace($this->workspace)->create();
    $other = Workspace::factory()->ownedBy($this->owner)->create();

    expect(automationVerdict($this->owner, 'use', [$scoped, $other]))->toBe('deny')
        ->and(automationVerdict($this->owner, 'update', $scoped))->toBe('allow')
        ->and(automationVerdict($this->member, 'update', $scoped))->toBe('deny');
});

it('lets only the creator or Super Admin change a company task template', function () {
    $template = TaskTemplate::factory()->create(['created_by' => $this->owner->id]);

    expect(automationVerdict($this->owner, 'update', $template))->toBe('allow')
        ->and(automationVerdict(automationActor('kadiv'), 'update', $template))->toBe('deny')
        ->and(automationVerdict(automationActor('super_admin'), 'delete', $template))->toBe('allow');
});

it('applies the workspace template matrix', function (string $actor, string $view, string $saveFrom, string $use, string $delete) {
    $template = WorkspaceTemplate::factory()->create(['created_by' => $this->owner->id]);
    $user = automationActor($actor);

    expect([
        automationVerdict($user, 'view', $template),
        automationVerdict($user, 'create', [WorkspaceTemplate::class, $this->workspace]),
        automationVerdict($user, 'use', $template),
        automationVerdict($user, 'delete', $template),
    ])->toBe([$view, $saveFrom, $use, $delete]);
})->with([
    //                     view     save     use      delete
    'owner (kadiv, creator)' => ['owner', 'allow', 'allow', 'allow', 'allow'],
    'admin (anggota)' => ['admin', 'allow', 'allow', 'deny', 'deny'],
    'member' => ['member', 'allow', 'deny', 'deny', 'deny'],
    'kadiv (not a member)' => ['kadiv', 'allow', 'hidden', 'allow', 'deny'],
    'direksi' => ['direksi', 'allow', 'hidden', 'allow', 'deny'],
    'hr' => ['hr', 'allow', 'hidden', 'deny', 'deny'],
    'super admin' => ['super_admin', 'allow', 'hidden', 'allow', 'allow'],
    'other company' => ['foreign', 'hidden', 'hidden', 'hidden', 'hidden'],
    'inactive admin' => ['inactive_member', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('does not save personal or division workspaces as templates', function () {
    $owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    // Every new user gets a personal workspace automatically.
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $owner->id)->first()
        ?? Workspace::factory()->personal($owner)->create();

    expect(automationVerdict($owner, 'create', [WorkspaceTemplate::class, $personal]))->toBe('deny');
});

it('applies the Kinerja saya matrix', function (string $actor, string $verdict) {
    $manager = User::factory()->withRole(Role::KepalaDivisi)->create();
    $subject = User::factory()->managedBy($manager)->create();

    $viewer = match ($actor) {
        'self' => $subject,
        'manager' => $manager,
        'manager_of_manager' => tap(User::factory()->withRole(Role::KepalaDivisi)->create(), fn (User $boss) => $manager->update(['manager_id' => $boss->id])),
        default => automationActor($actor),
    };

    expect(automationVerdict($viewer, 'viewPerformance', $subject))->toBe($verdict);
})->with([
    'self' => ['self', 'allow'],
    'direct manager' => ['manager', 'allow'],
    'manager of the manager' => ['manager_of_manager', 'hidden'],
    'hr' => ['hr', 'allow'],
    'kadiv of another line' => ['kadiv', 'hidden'],
    'direksi' => ['direksi', 'hidden'],
    'super admin' => ['super_admin', 'hidden'],
    'anggota' => ['anggota', 'hidden'],
    'other company' => ['foreign', 'hidden'],
]);

it('hides Kinerja saya from an inactive viewer', function () {
    $user = User::factory()->inactive()->create();

    expect(automationVerdict($user, 'viewPerformance', $user))->toBe('hidden');
});
