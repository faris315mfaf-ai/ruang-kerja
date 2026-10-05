<?php

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Domain\Organization\Enums\Role;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\GoogleAccount;
use App\Models\User;
use App\Policies\AttachmentPolicy;
use App\Policies\DriveFilePolicy;
use App\Policies\GoogleAccountPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;
use Tests\Fixtures\Google\FolderOwner;
use Tests\Fixtures\Google\FolderOwnerPolicy;
use Tests\Fixtures\Google\StubWorkspaceDriveAccess;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('auto-discovers the Google policies', function () {
    expect(Gate::getPolicyFor(GoogleAccount::class))->toBeInstanceOf(GoogleAccountPolicy::class)
        ->and(Gate::getPolicyFor(DriveFile::class))->toBeInstanceOf(DriveFilePolicy::class)
        ->and(Gate::getPolicyFor(Attachment::class))->toBeInstanceOf(AttachmentPolicy::class);
});

describe('GoogleAccountPolicy', function () {
    it('lets every role connect and use the Picker but touch only their own account', function (Role $role) {
        $user = User::factory()->withRole($role)->create();
        $own = GoogleAccount::factory()->for($user)->create();
        $other = GoogleAccount::factory()->create();
        $gate = Gate::forUser($user);

        expect($gate->allows('connect', GoogleAccount::class))->toBeTrue()
            ->and($gate->allows('usePicker', GoogleAccount::class))->toBeTrue()
            ->and($gate->allows('view', $own))->toBeTrue()
            ->and($gate->allows('delete', $own))->toBeTrue()
            ->and($gate->allows('view', $other))->toBeFalse()
            ->and($gate->allows('delete', $other))->toBeFalse();
    })->with(Role::cases());
});

describe('DriveFilePolicy', function () {
    it('denies every role until the Workspaces module grants access (fail-closed)', function (Role $role) {
        $user = User::factory()->withRole($role)->create();
        $file = DriveFile::factory()->create(['added_by' => $user->id]);
        $gate = Gate::forUser($user);

        expect($gate->allows('viewAny', [DriveFile::class, $file->workspace_id]))->toBeFalse()
            ->and($gate->allows('view', $file))->toBeFalse()
            ->and($gate->allows('create', [DriveFile::class, $file->workspace_id]))->toBeFalse()
            ->and($gate->allows('delete', $file))->toBeFalse()
            ->and(DriveFile::query()->visibleTo($user)->count())->toBe(0);
    })->with(Role::cases());

    it('follows workspace access levels', function (Role $role, ?string $level, array $expected) {
        $access = new StubWorkspaceDriveAccess;
        app()->instance(WorkspaceDriveAccess::class, $access);

        $user = User::factory()->withRole($role)->create();
        $file = DriveFile::factory()->create();
        $mine = DriveFile::factory()->create(['workspace_id' => $file->workspace_id, 'added_by' => $user->id]);
        DriveFile::factory()->create();

        if ($level !== null) {
            $access->grant($user, $file->workspace_id, $level);
        }

        $gate = Gate::forUser($user);

        expect([
            'viewAny' => $gate->allows('viewAny', [DriveFile::class, $file->workspace_id]),
            'view' => $gate->allows('view', $file),
            'create' => $gate->allows('create', [DriveFile::class, $file->workspace_id]),
            'delete' => $gate->allows('delete', $file),
            'deleteOwn' => $gate->allows('delete', $mine),
            'listed' => DriveFile::query()->visibleTo($user)->count(),
        ])->toBe($expected);
    })->with(function () {
        $none = ['viewAny' => false, 'view' => false, 'create' => false, 'delete' => false, 'deleteOwn' => false, 'listed' => 0];
        $viewer = ['viewAny' => true, 'view' => true, 'create' => false, 'delete' => false, 'deleteOwn' => false, 'listed' => 2];
        $contributor = ['viewAny' => true, 'view' => true, 'create' => true, 'delete' => false, 'deleteOwn' => true, 'listed' => 2];
        $manager = ['viewAny' => true, 'view' => true, 'create' => true, 'delete' => true, 'deleteOwn' => true, 'listed' => 2];

        foreach (Role::cases() as $role) {
            yield "{$role->value} without access" => [$role, null, $none];
            yield "{$role->value} viewer" => [$role, 'viewer', $viewer];
            yield "{$role->value} contributor" => [$role, 'contributor', $contributor];
            yield "{$role->value} manager" => [$role, 'manager', $manager];
        }
    });
});

describe('AttachmentPolicy', function () {
    beforeEach(function () {
        Gate::policy(FolderOwner::class, FolderOwnerPolicy::class);
    });

    it('inherits view/update rights from the parent', function (string $who, array $expected) {
        $uploader = User::factory()->withRole(Role::Anggota)->create();
        $member = User::factory()->withRole(Role::Anggota)->create();
        $viewer = User::factory()->withRole(Role::KepalaDivisi)->create();
        $outsider = User::factory()->withRole(Role::SuperAdmin)->create();
        $formerUploader = User::factory()->withRole(Role::Anggota)->create();

        $task = FolderOwner::createWith('Tugas', [
            $uploader->email => 'viewer',
            $member->email => 'member',
            $viewer->email => 'viewer',
        ]);

        $attachment = Attachment::factory()->for($task, 'attachable')->create(['uploaded_by' => $uploader->id]);
        $orphan = Attachment::factory()->for($task, 'attachable')->create(['uploaded_by' => $formerUploader->id]);

        $actor = match ($who) {
            'uploader' => $uploader,
            'member' => $member,
            'viewer' => $viewer,
            'outsider' => $outsider,
            'former uploader' => $formerUploader,
        };
        $gate = Gate::forUser($actor);
        $target = $who === 'former uploader' ? $orphan : $attachment;

        expect([
            'view' => $gate->allows('view', $target),
            'create' => $gate->allows('create', [Attachment::class, $task]),
            'delete' => $gate->allows('delete', $target),
        ])->toBe($expected);
    })->with([
        'uploader (viewer of the task)' => ['uploader', ['view' => true, 'create' => false, 'delete' => true]],
        'member who can edit the task' => ['member', ['view' => true, 'create' => true, 'delete' => true]],
        'viewer who did not upload' => ['viewer', ['view' => true, 'create' => false, 'delete' => false]],
        'super admin outside the task' => ['outsider', ['view' => false, 'create' => false, 'delete' => false]],
        'uploader who left the task' => ['former uploader', ['view' => false, 'create' => false, 'delete' => false]],
    ]);

    it('denies everything when the parent is gone', function () {
        $user = User::factory()->create();
        $task = FolderOwner::createWith('Tugas', [$user->email => 'owner']);
        $attachment = Attachment::factory()->for($task, 'attachable')->create(['uploaded_by' => $user->id]);
        $task->delete();

        $attachment = $attachment->fresh();

        expect(Gate::forUser($user)->allows('view', $attachment))->toBeFalse()
            ->and(Gate::forUser($user)->allows('delete', $attachment))->toBeFalse();
    });
});
