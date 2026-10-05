<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Actions\SyncDivisionMembers;
use App\Domain\Workspaces\Actions\SyncTeamMembers;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

function divisionWorkspace(Division $division): ?Workspace
{
    return Workspace::query()->where('type', WorkspaceType::Division->value)->where('division_id', $division->id)->first();
}

/**
 * @return array<string, string>
 */
function rolesIn(Workspace $workspace): array
{
    return $workspace->memberships()->get()->mapWithKeys(fn ($member) => [$member->user_id => $member->role->value])->all();
}

it('creates the division workspace with every active employee when a division gets a head', function () {
    $head = User::factory()->withRole(Role::KepalaDivisi)->create();
    $division = Division::factory()->headedBy($head)->create(['name' => 'Operasional', 'code' => 'OPS']);
    $staff = User::factory()->inDivision($division)->create();
    User::factory()->inDivision($division)->inactive()->create();

    $workspace = divisionWorkspace($division);

    expect($workspace)->not->toBeNull()
        ->and($workspace->name)->toBe('Divisi Operasional')
        ->and($workspace->key)->toBe('OPS')
        ->and($workspace->owner_id)->toBe($head->id)
        ->and(rolesIn($workspace))->toEqual([$head->id => 'owner', $staff->id => 'member'])
        ->and($workspace->statuses()->count())->toBe(5);
});

it('moves members between division workspaces when an employee changes division', function () {
    $ops = Division::factory()->headedBy(User::factory()->create())->create();
    $keu = Division::factory()->headedBy(User::factory()->create())->create();
    $rizky = User::factory()->inDivision($ops)->create();

    expect(divisionWorkspace($ops)->roleOf($rizky))->toBe(WorkspaceRole::Member)
        ->and(divisionWorkspace($keu)->roleOf($rizky))->toBeNull();

    Event::fake([WorkspaceMembersChanged::class]);
    $rizky->update(['division_id' => $keu->id]);

    expect(divisionWorkspace($ops)->roleOf($rizky))->toBeNull()
        ->and(divisionWorkspace($keu)->roleOf($rizky))->toBe(WorkspaceRole::Member);

    Event::assertDispatched(WorkspaceMembersChanged::class, fn ($event) => $event->workspace->division_id === $ops->id && $event->removedUserIds === [$rizky->id]);
    Event::assertDispatched(WorkspaceMembersChanged::class, fn ($event) => $event->workspace->division_id === $keu->id && $event->addedUserIds === [$rizky->id]);
});

it('removes employees who become inactive and keeps manual members and edited roles', function () {
    $division = Division::factory()->headedBy(User::factory()->create())->create();
    $staff = User::factory()->inDivision($division)->create();
    $promoted = User::factory()->inDivision($division)->create();
    $guest = User::factory()->withRole(Role::Direksi)->create();
    $workspace = divisionWorkspace($division);

    addMember($workspace, $guest, WorkspaceRole::Viewer);
    $workspace->memberships()->where('user_id', $promoted->id)->update(['role' => 'admin']);

    $staff->update(['status' => 'resigned']);
    app(SyncDivisionMembers::class)->handle($division);

    expect($workspace->roleOf($staff))->toBeNull()
        ->and($workspace->roleOf($guest))->toBe(WorkspaceRole::Viewer)
        ->and($workspace->roleOf($promoted))->toBe(WorkspaceRole::Admin);
});

it('hands ownership to a new Kepala Divisi', function () {
    $old = User::factory()->create();
    $division = Division::factory()->headedBy($old)->create();
    $old->update(['division_id' => $division->id]);
    $new = User::factory()->inDivision($division)->create();

    $division->update(['head_user_id' => $new->id]);
    $workspace = divisionWorkspace($division)->fresh();

    expect($workspace->owner_id)->toBe($new->id)
        ->and($workspace->roleOf($new))->toBe(WorkspaceRole::Owner)
        ->and($workspace->roleOf($old))->toBe(WorkspaceRole::Member);
});

it('is idempotent and renames/archives together with the division', function () {
    $division = Division::factory()->headedBy(User::factory()->create())->create(['name' => 'Keuangan']);
    User::factory()->count(2)->inDivision($division)->create();

    app(SyncDivisionMembers::class)->handle($division);
    app(SyncDivisionMembers::class)->handle($division);

    $workspace = divisionWorkspace($division);
    expect(Workspace::query()->where('division_id', $division->id)->count())->toBe(1)
        ->and($workspace->memberships()->count())->toBe(3);

    $division->update(['name' => 'Keuangan & Pajak']);
    expect($workspace->fresh()->name)->toBe('Divisi Keuangan & Pajak');

    $division->delete();
    expect($workspace->fresh()->isArchived())->toBeTrue();

    $division->restore();
    expect($workspace->fresh()->isArchived())->toBeFalse();
});

it('falls back to a Super Admin as owner for a division without head', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $division = Division::factory()->create();

    $workspace = app(SyncDivisionMembers::class)->handle($division);

    expect($workspace?->owner_id)->toBe($admin->id);
});

it('syncs team workspaces with the team and its lead', function () {
    $owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $lead = User::factory()->create();
    $team = Team::factory()->ledBy($lead)->create();
    $lead->update(['team_id' => $team->id]);
    $workspace = Workspace::factory()->ownedBy($owner)->team($team)->create();
    $member = User::factory()->create(['team_id' => $team->id]);

    app(SyncTeamMembers::class)->handle($team);
    expect(rolesIn($workspace))->toEqual([$owner->id => 'owner', $lead->id => 'admin', $member->id => 'member']);

    $member->update(['team_id' => null]);
    expect($workspace->roleOf($member))->toBeNull();
});
