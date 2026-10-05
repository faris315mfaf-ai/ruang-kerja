<?php

use App\Domain\Google\Data\DriveMember;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Services\DrivePermissionSync;
use App\Domain\Google\Testing\FakeDriveClient;

beforeEach(function () {
    $this->drive = FakeDriveClient::fake();
    $this->folder = $this->drive->seedFolder('Proyek Peluncuran Q4 [PLQ]')->id;
    $this->sync = app(DrivePermissionSync::class);
});

/**
 * @param  array<string, string>  $members  email => workspace role
 * @return list<DriveMember>
 */
function members(array $members): array
{
    return array_map(fn ($email, $role) => DriveMember::forWorkspaceRole($email, $role), array_keys($members), $members);
}

it('grants writer to owners, admins and members and reader to viewers', function () {
    $result = $this->sync->sync($this->folder, members([
        'dimas@demo.test' => 'owner',
        'hana@demo.test' => 'admin',
        'rizky@demo.test' => 'member',
        'hendra@demo.test' => 'viewer',
    ]));

    expect($this->drive->directAccess($this->folder))->toBe([
        'dimas@demo.test' => 'writer',
        'hana@demo.test' => 'writer',
        'hendra@demo.test' => 'reader',
        'rizky@demo.test' => 'writer',
    ])->and($result->added)->toHaveCount(4)
        ->and($this->drive->calls('permissions.create')[0]['arguments']['notify'])->toBeFalse();
});

it('revokes members who left and changes roles that differ', function () {
    $this->sync->sync($this->folder, members(['dimas@demo.test' => 'owner', 'rizky@demo.test' => 'member', 'sari@demo.test' => 'member']));

    $result = $this->sync->sync($this->folder, members(['dimas@demo.test' => 'owner', 'rizky@demo.test' => 'viewer']));

    expect($this->drive->directAccess($this->folder))->toBe(['dimas@demo.test' => 'writer', 'rizky@demo.test' => 'reader'])
        ->and($result->removed)->toBe(['sari@demo.test'])
        ->and($result->updated)->toBe(['rizky@demo.test'])
        ->and($result->added)->toBe([]);
    $this->drive->assertNoPermission($this->folder, 'sari@demo.test');
});

it('is idempotent: a second run makes no changes', function () {
    $members = members(['dimas@demo.test' => 'owner', 'hendra@demo.test' => 'viewer']);
    $this->sync->sync($this->folder, $members);
    $this->drive->resetCalls();

    $result = $this->sync->sync($this->folder, $members);

    expect($result->hasChanges())->toBeFalse();
    $this->drive->assertNoWrites();
});

it('never revokes Shared Drive members, the impersonated admin, protected or non-user permissions', function () {
    config([
        'google.service_account.impersonate' => 'Drive-Admin@demo.test',
        'google.permissions.protected_emails' => ['auditor@demo.test'],
    ]);
    $this->drive->seedPermission($this->folder, 'manager@demo.test', 'organizer', inherited: true);
    $this->drive->seedPermission($this->folder, 'drive-admin@demo.test', DriveRole::Writer);
    $this->drive->seedPermission($this->folder, 'auditor@demo.test', DriveRole::Reader);
    $this->drive->seedPermission($this->folder, 'demo.test', DriveRole::Reader, type: 'domain');
    $this->drive->seedPermission($this->folder, 'outsider@gmail.com', DriveRole::Writer);

    $result = $this->sync->sync($this->folder, members(['dimas@demo.test' => 'owner']));

    expect($result->removed)->toBe(['outsider@gmail.com'])
        ->and($this->drive->directAccess($this->folder))->toBe([
            'auditor@demo.test' => 'reader',
            'dimas@demo.test' => 'writer',
            'drive-admin@demo.test' => 'writer',
        ])
        ->and(count($this->drive->permissionsFor($this->folder)))->toBe(5);
});

it('relies on inherited access when it already covers the desired role', function () {
    $this->drive->seedPermission($this->folder, 'hendra@demo.test', 'organizer', inherited: true);
    $this->drive->seedPermission($this->folder, 'maya@demo.test', DriveRole::Reader, inherited: true);

    $result = $this->sync->sync($this->folder, members(['hendra@demo.test' => 'member', 'maya@demo.test' => 'member']));

    expect($result->added)->toBe(['maya@demo.test']);
});

it('does not downgrade roles a Drive admin granted on purpose', function () {
    $this->drive->seedPermission($this->folder, 'dimas@demo.test', 'fileOrganizer');

    $result = $this->sync->sync($this->folder, members(['dimas@demo.test' => 'viewer']));

    expect($result->skipped)->toBe(['dimas@demo.test' => 'elevated_role']);
    $this->drive->assertNotCalled('permissions.update');
});

it('normalises e-mails, keeps the highest duplicate role and skips invalid addresses', function () {
    $result = $this->sync->sync($this->folder, [
        new DriveMember('Rizky@Demo.test', DriveRole::Reader),
        new DriveMember('rizky@demo.test', DriveRole::Writer),
        new DriveMember('bukan-email', DriveRole::Writer),
    ]);

    expect($this->drive->directAccess($this->folder))->toBe(['rizky@demo.test' => 'writer'])
        ->and($result->skipped)->toBe(['bukan-email' => 'invalid_email']);
});

it('skips people Google rejects and continues with the rest', function () {
    $this->drive->failNext('permissions.create', 400, 'invalidSharingRequest', when: fn ($arguments) => $arguments['email'] === 'external@gmail.com');

    $result = $this->sync->sync($this->folder, members(['external@gmail.com' => 'member', 'dimas@demo.test' => 'owner']));

    expect($result->skipped)->toBe(['external@gmail.com' => 'invalidSharingRequest'])
        ->and($result->added)->toBe(['dimas@demo.test']);
});

it('treats an already removed permission (404) as removed', function () {
    $permission = $this->drive->seedPermission($this->folder, 'sari@demo.test', DriveRole::Writer);
    $this->drive->failNext('permissions.delete', 404, 'notFound');

    $result = $this->sync->sync($this->folder, []);

    expect($result->removed)->toBe(['sari@demo.test'])
        ->and($permission->id)->not->toBeEmpty();
});

it('bubbles up rate limits so the job can back off', function () {
    $this->drive->rateLimitNext('permissions.create');

    $this->sync->sync($this->folder, members(['dimas@demo.test' => 'owner']));
})->throws(DriveRequestFailed::class);

it('fails when the folder no longer exists', function () {
    $this->drive->forget($this->folder);

    $this->sync->sync($this->folder, members(['dimas@demo.test' => 'owner']));
})->throws(DriveRequestFailed::class, 'permissions.list');
