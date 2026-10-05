<?php

use App\Domain\Google\Data\DriveItem;
use App\Domain\Google\Services\DriveFileRecorder;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;

/*
 * One drive_files row per Drive file (google_file_id is unique): recording it
 * for another workspace must not silently restore or move rows incorrectly.
 */

beforeEach(function () {
    $this->a = Workspace::factory()->create();
    $this->b = Workspace::factory()->create();
    $this->alice = User::factory()->create();
    $this->bob = User::factory()->create();
    $this->recorder = app(DriveFileRecorder::class);
});

function driveItem(string $parent = 'folder-a'): DriveItem
{
    return new DriveItem(id: 'file-1234567890', name: 'Anggaran.xlsx', mimeType: 'application/vnd.ms-excel', parents: [$parent]);
}

it('leaves a live row of another workspace in place when the file is linked elsewhere', function () {
    $this->recorder->record(driveItem(), $this->a->id, $this->alice, 'folder-a');

    $file = $this->recorder->record(driveItem('folder-a'), $this->b->id, $this->bob);

    expect($file->workspace_id)->toBe($this->a->id)
        ->and($file->added_by)->toBe($this->alice->id)
        ->and($file->parent_google_id)->toBe('folder-a')
        ->and(DriveFile::query()->count())->toBe(1);
});

it('re-homes a row the other workspace removed instead of restoring it there', function () {
    $this->recorder->record(driveItem(), $this->a->id, $this->alice, 'folder-a')->delete();

    $file = $this->recorder->record(driveItem('folder-x'), $this->b->id, $this->bob);

    expect($file->workspace_id)->toBe($this->b->id)
        ->and($file->added_by)->toBe($this->bob->id)
        ->and($file->trashed())->toBeFalse()
        ->and(DriveFile::query()->where('workspace_id', $this->a->id)->exists())->toBeFalse();
});

it('moves the row to the workspace whose folder now holds the file', function () {
    $this->recorder->record(driveItem(), $this->a->id, $this->alice, 'folder-a');

    // Folder sync of workspace B finds the file (moved in Drive).
    $file = $this->recorder->record(driveItem('folder-b'), $this->b->id, null, 'folder-b');

    expect($file->workspace_id)->toBe($this->b->id)
        ->and($file->parent_google_id)->toBe('folder-b')
        ->and($file->added_by)->toBe($this->alice->id);
});

it('restores and updates a row of the same workspace', function () {
    $this->recorder->record(driveItem(), $this->a->id, $this->alice, 'folder-a')->delete();

    $file = $this->recorder->record(driveItem('folder-a2'), $this->a->id, $this->bob, 'folder-a2');

    expect($file->trashed())->toBeFalse()
        ->and($file->workspace_id)->toBe($this->a->id)
        ->and($file->added_by)->toBe($this->alice->id)
        ->and($file->parent_google_id)->toBe('folder-a2');
});
