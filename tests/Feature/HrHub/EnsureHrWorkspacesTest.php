<?php

use App\Domain\HrHub\Actions\AssignHrTask;
use App\Domain\HrHub\Actions\EnsureHrWorkspaces;
use App\Domain\HrHub\Enums\SystemWorkspace;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Actions\AddWorkspaceMember;
use App\Domain\Workspaces\Actions\UpdateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Tenancy\Scheduling\CompanySchedule;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Channel;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/*
 * Ruang HR system workspaces (keputusan pemilik 20 Okt 2026): "Tim HR" and
 * "Penugasan HR" per company, admins synced from the HR / Super Admin roles.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana HR']);
    $this->admin = User::factory()->withRole(Role::SuperAdmin)->create(['name' => 'Admin']);
    $this->employee = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky']);
});

/** @return array<string, string> user id => role */
function hrRoles(Workspace $workspace): array
{
    return WorkspaceMember::query()->where('workspace_id', $workspace->id)->get()
        ->mapWithKeys(fn (WorkspaceMember $member): array => [$member->user_id => $member->role->value])->all();
}

it('creates both system workspaces with HR as owner and Super Admin as admin', function () {
    $workspaces = app(EnsureHrWorkspaces::class)->handle($this->hr->company_id);
    $team = $workspaces['hr_team'];
    $assignments = $workspaces['hr_assignments'];

    expect($team->system_key)->toBe(SystemWorkspace::HrTeam)
        ->and($team->name)->toBe('Tim HR')
        ->and($team->key)->toBe('TIMHR')
        ->and($team->tasks_private)->toBeFalse()
        ->and($assignments->name)->toBe('Penugasan HR')
        ->and($assignments->key)->toBe('PHR')
        ->and($assignments->tasks_private)->toBeTrue();

    foreach ([$team, $assignments] as $workspace) {
        expect($workspace->type)->toBe(WorkspaceType::Team)
            ->and($workspace->visibility)->toBe(WorkspaceVisibility::Private)
            ->and($workspace->team_id)->toBeNull()
            ->and($workspace->owner_id)->toBe($this->hr->id)
            ->and(WorkspaceKeyGenerator::isValid($workspace->key))->toBeTrue()
            ->and(hrRoles($workspace))->toEqual([$this->hr->id => 'owner', $this->admin->id => 'admin'])
            ->and(WorkspaceMember::query()->where('workspace_id', $workspace->id)->where('is_synced', false)->exists())->toBeFalse();
    }

    // Penugasan HR never gets a shared chat channel (it would reveal who got what).
    expect(Channel::query()->where('workspace_id', $assignments->id)->exists())->toBeFalse();
});

it('is idempotent: no new rows nor member events when already in sync', function () {
    $first = app(EnsureHrWorkspaces::class)->handle($this->hr->company_id);
    Event::fake([WorkspaceMembersChanged::class]);

    $second = app(EnsureHrWorkspaces::class)->handle($this->hr->company_id);

    expect($second['hr_team']->id)->toBe($first['hr_team']->id)
        ->and($second['hr_assignments']->id)->toBe($first['hr_assignments']->id)
        ->and(Workspace::query()->whereNotNull('system_key')->count())->toBe(2);
    Event::assertNotDispatched(WorkspaceMembersChanged::class);
});

it('picks a free key when the preferred one is taken', function () {
    Workspace::factory()->team()->ownedBy($this->hr)->create(['key' => 'PHR']);
    Workspace::factory()->team()->ownedBy($this->hr)->create(['key' => 'TIMHR', 'previous_keys' => []]);

    $workspaces = app(EnsureHrWorkspaces::class)->handle($this->hr->company_id);

    expect($workspaces['hr_assignments']->key)->toBe('PHR2')
        ->and($workspaces['hr_team']->key)->toBe('TIMHR2');
});

it('follows role changes: new HR join as admin, former HR leave, owner moves on', function () {
    $workspaces = app(EnsureHrWorkspaces::class)->handle($this->hr->company_id);
    $assignments = $workspaces['hr_assignments'];
    $newHr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hadi HR']);

    // The first HR got an assignment before leaving HR: stays as plain member.
    app(AssignHrTask::class)->handle($this->admin, ['user_ids' => [$this->hr->id], 'mode' => 'per_person', 'title' => 'Serah terima']);
    $this->hr->syncRoles([Role::Anggota->value]);

    app(EnsureHrWorkspaces::class)->handle($this->hr->company_id);

    expect($assignments->refresh()->owner_id)->toBe($newHr->id)
        ->and(hrRoles($assignments))->toEqual([$newHr->id => 'owner', $this->admin->id => 'admin', $this->hr->id => 'member'])
        ->and(hrRoles($workspaces['hr_team']->refresh()))->toEqual([$newHr->id => 'owner', $this->admin->id => 'admin']);

    // An employee given a task who later becomes HR is promoted and synced.
    app(AssignHrTask::class)->handle($newHr, ['user_ids' => [$this->employee->id], 'mode' => 'per_person', 'title' => 'Absen']);
    $this->employee->assignRole(Role::Hr->value);
    app(EnsureHrWorkspaces::class)->handle($this->hr->company_id);

    expect(WorkspaceMember::query()->where('workspace_id', $assignments->id)->where('user_id', $this->employee->id)->first(['role', 'is_synced'])?->only(['role', 'is_synced']))
        ->toEqual(['role' => WorkspaceRole::Admin, 'is_synced' => true]);
});

it('falls back to a Super Admin as owner and creates nothing without HR or Super Admin', function () {
    $this->hr->syncRoles([Role::Anggota->value]);

    expect(app(EnsureHrWorkspaces::class)->handle($this->hr->company_id)['hr_team']->owner_id)->toBe($this->admin->id);

    Workspace::query()->whereNotNull('system_key')->forceDelete();
    $this->admin->syncRoles([Role::Anggota->value]);

    expect(app(EnsureHrWorkspaces::class)->handle($this->hr->company_id))->toBe([]);
});

it('keeps system workspaces from being archived, re-keyed, opened up or given extra admins', function () {
    $assignments = app(EnsureHrWorkspaces::class)->handle($this->hr->company_id)['hr_assignments'];

    expect(Gate::forUser($this->hr)->allows('archive', $assignments))->toBeFalse()
        ->and(Gate::forUser($this->admin)->allows('archive', $assignments))->toBeFalse();

    app(UpdateWorkspace::class)->handle($assignments, $this->hr, ['key' => 'HRX', 'visibility' => WorkspaceVisibility::Internal, 'name' => 'Tugas dari HR']);
    $assignments->refresh();

    expect($assignments->key)->toBe('PHR')
        ->and($assignments->visibility)->toBe(WorkspaceVisibility::Private)
        ->and($assignments->name)->toBe('Tugas dari HR');

    expect(fn () => app(AddWorkspaceMember::class)->handle($assignments, $this->hr, $this->employee, WorkspaceRole::Admin))
        ->toThrow(ValidationException::class);
});

it('runs every day per company from the scheduler', function () {
    expect(app(CompanySchedule::class)->task(EnsureHrWorkspaces::class))->not->toBeNull();
});
