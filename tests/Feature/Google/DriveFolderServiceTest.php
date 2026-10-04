<?php

use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Services\DriveFolderService;
use App\Domain\Google\Testing\FakeDriveClient;
use Tests\Fixtures\Google\FolderOwner;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    $this->drive = FakeDriveClient::fake();
    $this->owner = FolderOwner::createWith('Proyek Peluncuran Q4 [PLQ]');
});

it('creates the folder in the Shared Drive root tagged with the owner key', function () {
    $result = app(DriveFolderService::class)->ensure($this->owner);

    $folder = $this->drive->assertFolderCreated('Proyek Peluncuran Q4 [PLQ]', $this->drive->sharedDriveId());

    expect($result->created)->toBeTrue()
        ->and($result->needsPermissionSync())->toBeTrue()
        ->and($result->folderId)->toBe($folder->id)
        ->and($this->owner->fresh()->drive_folder_id)->toBe($folder->id)
        ->and($folder->appProperties)->toBe(['rk_owner' => $this->owner->driveFolderKey()]);
});

it('is idempotent: a stored folder is verified, not created again', function () {
    $service = app(DriveFolderService::class);

    $first = $service->ensure($this->owner);
    $second = $service->ensure($this->owner->fresh());

    expect($second->folderId)->toBe($first->folderId)
        ->and($second->created)->toBeFalse()
        ->and($second->needsPermissionSync())->toBeFalse();

    $this->drive->assertCalled('files.create_folder', 1);
    $this->drive->assertFolderCount(1);
});

it('recovers a folder created by a job that died before saving its id', function () {
    $orphan = $this->drive->seedFolder('Proyek Peluncuran Q4 [PLQ]', appProperties: ['rk_owner' => $this->owner->driveFolderKey()]);

    $result = app(DriveFolderService::class)->ensure($this->owner);

    expect($result->recovered)->toBeTrue()
        ->and($result->folderId)->toBe($orphan->id)
        ->and($this->owner->fresh()->drive_folder_id)->toBe($orphan->id);

    $this->drive->assertNotCalled('files.create_folder');
});

it('creates a new folder when the stored one was deleted or trashed', function (string $how) {
    $service = app(DriveFolderService::class);
    $old = $service->ensure($this->owner)->folderId;

    $how === 'deleted' ? $this->drive->forget($old) : $this->drive->trash($old);

    $result = $service->ensure($this->owner->fresh());

    expect($result->created)->toBeTrue()
        ->and($result->folderId)->not->toBe($old)
        ->and($this->owner->fresh()->drive_folder_id)->toBe($result->folderId);
})->with(['deleted', 'trashed']);

it('renames the folder after the owner was renamed', function () {
    $service = app(DriveFolderService::class);
    $folderId = $service->ensure($this->owner)->folderId;

    $this->owner->update(['name' => 'Peluncuran Produk X [PLQ]']);
    $result = $service->ensure($this->owner->fresh());

    expect($result->renamed)->toBeTrue()
        ->and($this->drive->file($folderId)?->name)->toBe('Peluncuran Produk X [PLQ]');
});

it('creates sub-folders under the owner parent folder', function () {
    $parent = $this->drive->seedFolder('Workspace');
    $this->owner->update(['parent_folder_id' => $parent->id]);

    app(DriveFolderService::class)->ensure($this->owner->fresh());

    $this->drive->assertFolderCreated('Proyek Peluncuran Q4 [PLQ]', $parent->id);
});

it('refuses to work when Google is not configured', function () {
    GoogleTesting::disable();

    app(DriveFolderService::class)->ensure($this->owner);
})->throws(GoogleNotConfigured::class);
