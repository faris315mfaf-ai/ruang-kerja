<?php

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Jobs\CreateDriveFolder;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Domain\Google\Services\DriveFolderContentsSync;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Domain\Organization\Actions\DeactivateEmployee;
use App\Domain\Organization\Actions\ReactivateEmployee;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Workspaces\Actions\AddWorkspaceMember;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Actions\RemoveWorkspaceMember;
use App\Domain\Workspaces\Actions\UpdateWorkspace;
use App\Domain\Workspaces\Actions\UpdateWorkspaceMemberRole;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Queries\WorkspaceDriveStatus;
use App\Domain\Workspaces\Services\WorkspacePolicyDriveAccess;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\Fixtures\Google\GoogleTesting;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->drive = FakeDriveClient::fake();
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create(['email' => 'dimas@demo.test']);
    $this->drive->resetCalls();
});

function createProject(User $owner, string $name = 'Proyek Peluncuran Q4', string $key = 'PLQ'): Workspace
{
    return app(CreateWorkspace::class)->handle($owner, ['type' => WorkspaceType::Project, 'name' => $name, 'key' => $key]);
}

it('creates the Drive folder when a shared workspace is created and grants the owner', function () {
    $workspace = createProject($this->owner);

    $folder = $this->drive->assertFolderCreated('Proyek Peluncuran Q4 [PLQ]');
    $this->drive->assertPermission($folder->id, 'dimas@demo.test', DriveRole::Writer);

    expect($workspace->fresh()->drive_folder_id)->toBe($folder->id)
        ->and(app(WorkspaceDriveStatus::class)->members($workspace)[$this->owner->id]['status'])->toBe('synced')
        ->and(app(WorkspaceDriveStatus::class)->summary($workspace))->toMatchArray(['state' => 'synced', 'synced' => 1, 'total' => 1]);
});

it('does not create a folder for personal workspaces until they are used', function () {
    $personal = Workspace::query()->where('owner_id', $this->owner->id)->where('type', WorkspaceType::Personal->value)->firstOrFail();

    $this->drive->assertFolderCount(0);
    expect($personal->drive_folder_id)->toBeNull()
        ->and(app(WorkspaceDriveStatus::class)->summary($personal)['state'])->toBe('unused');
});

it('grants, changes and revokes access when members change', function () {
    $workspace = createProject($this->owner);
    $folderId = $workspace->fresh()->drive_folder_id;
    $rizky = User::factory()->create(['email' => 'rizky@demo.test']);
    $sari = User::factory()->create(['email' => 'sari@demo.test']);

    app(AddWorkspaceMember::class)->handle($workspace, $this->owner, $rizky, WorkspaceRole::Member);
    app(AddWorkspaceMember::class)->handle($workspace, $this->owner, $sari, WorkspaceRole::Viewer);

    $this->drive->assertPermission($folderId, 'rizky@demo.test', DriveRole::Writer);
    $this->drive->assertPermission($folderId, 'sari@demo.test', DriveRole::Reader);

    app(UpdateWorkspaceMemberRole::class)->handle($workspace, $this->owner, $sari, WorkspaceRole::Admin);
    $this->drive->assertPermission($folderId, 'sari@demo.test', DriveRole::Writer);

    app(RemoveWorkspaceMember::class)->handle($workspace, $this->owner, $rizky);
    $this->drive->assertNoPermission($folderId, 'rizky@demo.test');

    $statuses = app(WorkspaceDriveStatus::class)->members($workspace);
    expect($statuses)->toHaveCount(2)
        ->and($statuses[$sari->id]['status'])->toBe('synced');
});

it('is idempotent: syncing again writes nothing', function () {
    $workspace = createProject($this->owner);
    addMember($workspace, User::factory()->create(['email' => 'maya@demo.test']), WorkspaceRole::Member);
    SyncDrivePermissions::dispatch($workspace);
    $this->drive->resetCalls();

    SyncDrivePermissions::dispatch($workspace->fresh());
    CreateDriveFolder::dispatch($workspace->fresh());

    $this->drive->assertNoWrites();
    $this->drive->assertFolderCount(1);
});

it('shows members as pending until the sync confirms their current role', function () {
    Queue::fake();
    $workspace = createProject($this->owner);
    $workspace->forceFill(['drive_folder_id' => $this->drive->seedFolder('Proyek Peluncuran Q4 [PLQ]')->id])->saveQuietly();
    $rizky = User::factory()->create(['email' => 'rizky@demo.test']);

    app(AddWorkspaceMember::class)->handle($workspace, $this->owner, $rizky, WorkspaceRole::Member);

    Queue::assertPushed(SyncDrivePermissions::class);
    expect(app(WorkspaceDriveStatus::class)->members($workspace)[$rizky->id])->toMatchArray(['status' => 'pending', 'label' => 'Menunggu sinkron'])
        ->and(app(WorkspaceDriveStatus::class)->summary($workspace)['state'])->toBe('pending');
});

it('marks a member Google rejects as failed while the others are synced', function () {
    $workspace = createProject($this->owner);
    $rizky = addMember($workspace, User::factory()->create(['email' => 'rizky@demo.test']), WorkspaceRole::Member);
    $this->drive->failNext('permissions.create', 400, 'invalidSharingRequest', when: fn (array $arguments) => ($arguments['email'] ?? null) === 'rizky@demo.test');

    SyncDrivePermissions::dispatch($workspace);

    $statuses = app(WorkspaceDriveStatus::class)->members($workspace);
    expect($statuses[$rizky->id])->toMatchArray(['status' => 'error', 'error' => 'invalidSharingRequest'])
        ->and($statuses[$this->owner->id]['status'])->toBe('synced')
        ->and(app(WorkspaceDriveStatus::class)->summary($workspace)['state'])->toBe('error');

    SyncDrivePermissions::dispatch($workspace);

    expect(app(WorkspaceDriveStatus::class)->members($workspace)[$rizky->id]['status'])->toBe('synced');
});

it('renames the folder when the workspace name or key changes', function () {
    $workspace = createProject($this->owner);
    $folderId = $workspace->fresh()->drive_folder_id;

    app(UpdateWorkspace::class)->handle($workspace->fresh(), $this->owner, ['name' => 'Peluncuran Q4', 'key' => 'PLQ4']);

    expect($this->drive->file($folderId)?->name)->toBe('Peluncuran Q4 [PLQ4]');
    $this->drive->assertFolderCount(1);
});

it('does nothing and shows a friendly state when Google is not configured', function () {
    GoogleTesting::disable();
    Queue::fake();

    $workspace = createProject($this->owner);
    app(AddWorkspaceMember::class)->handle($workspace, $this->owner, User::factory()->create(), WorkspaceRole::Member);

    Queue::assertNotPushed(CreateDriveFolder::class);
    Queue::assertNotPushed(SyncDrivePermissions::class);
    expect(app(WorkspaceDriveStatus::class)->summary($workspace)['state'])->toBe('disabled')
        ->and(app(WorkspaceDriveStatus::class)->members($workspace)[$this->owner->id]['label'])->toBe('Drive belum aktif');
});

it('gives Drive access to active members only (owner/admin/member write, viewer reads)', function () {
    $workspace = Workspace::factory()->ownedBy($this->owner)->create();
    addMember($workspace, User::factory()->create(['email' => 'hana@demo.test']), WorkspaceRole::Admin);
    addMember($workspace, User::factory()->create(['email' => 'hendra@demo.test']), WorkspaceRole::Viewer);
    addMember($workspace, User::factory()->inactive()->create(['email' => 'lama@demo.test']), WorkspaceRole::Member);

    $members = collect($workspace->driveMembers())->mapWithKeys(fn ($member) => [$member->email => $member->role->value])->all();

    expect($members)->toBe(['dimas@demo.test' => 'writer', 'hana@demo.test' => 'writer', 'hendra@demo.test' => 'reader'])
        ->and($workspace->driveFolderKey())->toBe('workspaces:'.$workspace->id);
});

it('derives Drive file access from WorkspacePolicy', function () {
    $access = app(WorkspaceDriveAccess::class);
    $workspace = Workspace::factory()->ownedBy($this->owner)->create();
    $member = memberWithRole($workspace, WorkspaceRole::Member);
    $viewer = memberWithRole($workspace, WorkspaceRole::Viewer);
    $direksi = User::factory()->withRole(Role::Direksi)->create(['company_id' => $this->owner->company_id]);
    $admin = User::factory()->withRole(Role::SuperAdmin)->create(['company_id' => $this->owner->company_id]);
    $personal = Workspace::query()->where('owner_id', $member->id)->where('type', WorkspaceType::Personal->value)->firstOrFail();

    expect($access)->toBeInstanceOf(WorkspacePolicyDriveAccess::class)
        ->and([$access->canView($viewer, $workspace->id), $access->canContribute($viewer, $workspace->id), $access->canManage($viewer, $workspace->id)])->toBe([true, false, false])
        ->and([$access->canView($member, $workspace->id), $access->canContribute($member, $workspace->id), $access->canManage($member, $workspace->id)])->toBe([true, true, false])
        ->and([$access->canView($this->owner, $workspace->id), $access->canManage($this->owner, $workspace->id)])->toBe([true, true])
        ->and([$access->canView($direksi, $workspace->id), $access->canContribute($direksi, $workspace->id)])->toBe([true, false])
        ->and($access->canView($admin, $personal->id))->toBeFalse()
        ->and($access->canView($member, $personal->id))->toBeTrue()
        ->and($access->canView($member, (string) str()->ulid()))->toBeFalse();

    $workspace->forceFill(['archived_at' => now()])->saveQuietly();

    expect($access->canContribute($member, $workspace->id))->toBeFalse()
        ->and($access->canManage($this->owner, $workspace->id))->toBeFalse()
        ->and($access->canView($member, $workspace->id))->toBeTrue();
});

it('treats a folder synced moments ago as fresh even when the cache returns a string (Redis)', function () {
    $sync = app(DriveFolderContentsSync::class);
    Cache::put('google:folder-synced:'.sha1('folder-x'), (string) now()->getTimestamp());

    expect($sync->isStale('folder-x'))->toBeFalse();

    $this->travel(6)->minutes();

    expect($sync->isStale('folder-x'))->toBeTrue();
});

it('revokes Drive access when a member is deactivated and restores it on reactivation', function () {
    $workspace = createProject($this->owner);
    $folderId = $workspace->fresh()->drive_folder_id;
    $rizky = User::factory()->create(['email' => 'rizky@demo.test']);
    app(AddWorkspaceMember::class)->handle($workspace, $this->owner, $rizky, WorkspaceRole::Member);
    $this->drive->assertPermission($folderId, 'rizky@demo.test', DriveRole::Writer);
    $hr = User::factory()->withRole(Role::Hr)->create();

    app(DeactivateEmployee::class)
        ->handle($hr, $rizky, UserStatus::Resigned, 'Resign');

    $this->drive->assertNoPermission($folderId, 'rizky@demo.test');
    $this->drive->assertPermission($folderId, 'dimas@demo.test', DriveRole::Writer);

    app(ReactivateEmployee::class)->handle($hr, $rizky->fresh());

    $this->drive->assertPermission($folderId, 'rizky@demo.test', DriveRole::Writer);
});

it('queues a Drive re-sync of the member workspaces on deactivation', function () {
    $workspace = createProject($this->owner);
    $rizky = User::factory()->create(['email' => 'rizky@demo.test']);
    app(AddWorkspaceMember::class)->handle($workspace, $this->owner, $rizky, WorkspaceRole::Member);
    $hr = User::factory()->withRole(Role::Hr)->create();
    Queue::fake();

    app(DeactivateEmployee::class)
        ->handle($hr, $rizky, UserStatus::Inactive, 'Cuti panjang');

    Queue::assertPushed(SyncDrivePermissions::class, fn (SyncDrivePermissions $job) => $job->owner->is($workspace));
});
