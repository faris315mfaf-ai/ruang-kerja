<?php

use App\Domain\Google\Contracts\DriveClient;
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Services\GoogleClientFactory;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

it('is what the factory and container hand out in fake mode', function () {
    $fake = FakeDriveClient::fake();
    $user = User::factory()->create();

    $service = app(GoogleClientFactory::class)->serviceAccount();
    $personal = app(GoogleClientFactory::class)->forUser($user);

    expect($service)->toBeInstanceOf(FakeDriveClient::class)
        ->and(app(DriveClient::class))->toBeInstanceOf(FakeDriveClient::class)
        ->and($personal->actor())->toBe($user->email);

    $folder = $service->createFolder('A', $fake->sharedDriveId());
    expect($personal->getFile($folder->id)->name)->toBe('A');

    expect(array_column($fake->calls(), 'actor'))->toBe(['service-account', $user->email]);
});

it('behaves like Drive for missing parents, files and permissions', function () {
    $fake = FakeDriveClient::fake();

    expect(fn () => $fake->createFolder('X', 'nope'))->toThrow(DriveRequestFailed::class)
        ->and(fn () => $fake->getFile('nope'))->toThrow(DriveRequestFailed::class)
        ->and(fn () => $fake->deletePermission($fake->seedFolder('Y')->id, 'perm-x'))->toThrow(DriveRequestFailed::class)
        ->and(fn () => $fake->createPermission($fake->seedFolder('Z')->id, 'not-an-email', DriveRole::Reader))->toThrow(DriveRequestFailed::class);
});

it('updates an existing permission instead of duplicating it', function () {
    $fake = FakeDriveClient::fake();
    $folder = $fake->seedFolder('Proyek');

    $fake->createPermission($folder->id, 'Rizky@demo.test', DriveRole::Reader);
    $fake->createPermission($folder->id, 'rizky@demo.test', DriveRole::Writer);

    expect($fake->directAccess($folder->id))->toBe(['rizky@demo.test' => 'writer']);
    $fake->assertPermission($folder->id, 'RIZKY@demo.test', DriveRole::Writer);
});

it('injects failures for matching calls only', function () {
    $fake = FakeDriveClient::fake();
    $folder = $fake->seedFolder('Proyek');

    $fake->failNext('permissions.create', 400, 'invalidSharingRequest', when: fn (array $arguments) => $arguments['email'] === 'bad@demo.test');

    $fake->createPermission($folder->id, 'good@demo.test', DriveRole::Writer);

    expect(fn () => $fake->createPermission($folder->id, 'bad@demo.test', DriveRole::Writer))
        ->toThrow(DriveRequestFailed::class);

    $fake->createPermission($folder->id, 'bad@demo.test', DriveRole::Writer);
    $fake->assertCalled('permissions.create', 3);
});

it('lists children folders first and hides trashed files', function () {
    $fake = FakeDriveClient::fake();
    $folder = $fake->seedFolder('Proyek');
    $fake->seedFile('b.pdf', 'application/pdf', $folder->id, 10);
    $trashed = $fake->seedFile('a.pdf', 'application/pdf', $folder->id, 10);
    $fake->seedFolder('Materi', $folder->id);
    $fake->trash($trashed->id);

    expect(array_map(fn ($item) => $item->name, $fake->listChildren($folder->id)))->toBe(['Materi', 'b.pdf']);
});

it('persists its Drive in the cache for local fake mode', function () {
    $first = new FakeDriveClient(persist: Cache::store());
    $folder = $first->createFolder('Lokal', FakeDriveClient::SHARED_DRIVE_ID);

    $second = new FakeDriveClient(persist: Cache::store());

    expect($second->getFile($folder->id)->name)->toBe('Lokal');
});
