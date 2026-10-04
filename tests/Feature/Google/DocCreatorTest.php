<?php

use App\Domain\Google\Actions\CreateGoogleDoc;
use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Google\Enums\GoogleDocType;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Domain\Google\Services\DocCreator;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Fixtures\Google\FolderOwner;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    $this->drive = FakeDriveClient::fake();
    $this->user = User::factory()->create();
    $this->owner = FolderOwner::createWith('Proyek Peluncuran Q4 [PLQ]', [$this->user->email => 'member']);
});

it('creates Docs, Sheets and Slides in the workspace folder and caches them', function (GoogleDocType $type, DriveFileKind $kind) {
    Queue::fake();
    $folderId = $this->drive->seedFolder('Proyek Peluncuran Q4 [PLQ]')->id;
    $this->owner->storeDriveFolderId($folderId);

    $file = app(DocCreator::class)->create($this->owner, $type, '  Brief landing page  ', $this->user);

    $this->drive->assertFileCreated('Brief landing page', $type->mimeType(), $folderId);

    expect($file)->toBeInstanceOf(DriveFile::class)
        ->and($file->kind)->toBe($kind)
        ->and($file->web_view_link)->toStartWith('https://docs.google.com/')
        ->and($file->workspace_id)->toBe($this->owner->id)
        ->and($file->parent_google_id)->toBe($folderId)
        ->and($file->added_by)->toBe($this->user->id)
        ->and($file->owner_email)->toBe($this->user->email);

    Queue::assertNotPushed(SyncDrivePermissions::class);
})->with([
    [GoogleDocType::Document, DriveFileKind::Doc],
    [GoogleDocType::Spreadsheet, DriveFileKind::Sheet],
    [GoogleDocType::Presentation, DriveFileKind::Slide],
]);

it('uses a default title when the name is blank', function () {
    $file = app(DocCreator::class)->create($this->owner, GoogleDocType::Spreadsheet, '   ', $this->user);

    expect($file->name)->toBe('Spreadsheet tanpa judul');
});

it('creates the folder on first use and queues the permission sync', function () {
    Queue::fake();

    app(DocCreator::class)->create($this->owner, GoogleDocType::Document, 'Notulen', $this->user);

    $this->drive->assertFolderCreated('Proyek Peluncuran Q4 [PLQ]');
    expect($this->owner->fresh()->drive_folder_id)->not->toBeNull();
    Queue::assertPushed(SyncDrivePermissions::class, fn (SyncDrivePermissions $job) => $job->owner->is($this->owner));
});

it('attaches the new document when asked (task / comment)', function () {
    $file = app(CreateGoogleDoc::class)->handle($this->owner, GoogleDocType::Document, 'Brief', $this->user, attachable: $this->owner);

    $attachment = Attachment::query()->sole();

    expect($attachment->drive_file_id)->toBe($file->id)
        ->and($attachment->attachable_id)->toBe($this->owner->id)
        ->and($attachment->filename)->toBe('Brief')
        ->and($attachment->uploaded_by)->toBe($this->user->id);
});

it('calls Google synchronously with the 10 second timeout', function () {
    GoogleTesting::useRealServiceAccount();
    Http::preventStrayRequests();
    $this->owner->storeDriveFolderId('folder-1');

    $timeouts = [];
    Http::fake([
        ...GoogleTesting::tokenResponse(),
        'www.googleapis.com/drive/v3/files/folder-1*' => function (Request $request, array $options) use (&$timeouts) {
            $timeouts[] = $options['timeout'];

            return Http::response(['id' => 'folder-1', 'name' => 'Proyek Peluncuran Q4 [PLQ]', 'mimeType' => 'application/vnd.google-apps.folder']);
        },
        'www.googleapis.com/drive/v3/files*' => function (Request $request, array $options) use (&$timeouts) {
            $timeouts[] = $options['timeout'];

            return Http::response(['id' => 'doc-1', 'name' => 'Brief', 'mimeType' => 'application/vnd.google-apps.document', 'webViewLink' => 'https://docs.google.com/document/d/doc-1/edit', 'parents' => ['folder-1']]);
        },
    ]);

    $file = app(DocCreator::class)->create($this->owner, GoogleDocType::Document, 'Brief', $this->user);

    expect($file->web_view_link)->toBe('https://docs.google.com/document/d/doc-1/edit')
        ->and($timeouts)->not->toBeEmpty()
        ->and(array_values(array_unique($timeouts)))->toBe([10]);
});

it('explains that Google is off instead of creating anything', function () {
    GoogleTesting::disable();

    app(DocCreator::class)->create($this->owner, GoogleDocType::Document, 'Brief', $this->user);
})->throws(GoogleNotConfigured::class);
