<?php

use App\Domain\Google\Actions\QueueDriveUpload;
use App\Domain\Google\Events\DriveFileUploaded;
use App\Domain\Google\Events\DriveUploadFailed;
use App\Domain\Google\Exceptions\DriveUploadTooLarge;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Jobs\UploadToDrive;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Fixtures\Google\FolderOwner;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    Storage::fake('local');
    $this->drive = FakeDriveClient::fake();
    config(['google.retry.jitter' => false, 'google.upload.chunk_bytes' => 256 * 1024]);
    $this->user = User::factory()->create();
    $this->owner = FolderOwner::createWith('Proyek Peluncuran Q4 [PLQ]', [$this->user->email => 'member']);
});

it('keeps the upload privately and queues it for Drive', function () {
    Queue::fake();
    $file = UploadedFile::fake()->create('Wireframe v3.pdf', 300, 'application/pdf');

    $uploadId = app(QueueDriveUpload::class)->handle($this->owner, $file, $this->user, $this->owner);

    Queue::assertPushed(UploadToDrive::class, function (UploadToDrive $job) use ($uploadId) {
        Storage::disk('local')->assertExists($job->path);

        return $job->uploadId === $uploadId
            && $job->filename === 'Wireframe v3.pdf'
            && $job->mimeType === 'application/pdf'
            && $job->path === "drive-uploads/{$uploadId}/upload.bin"
            && $job->uploader?->is($this->user)
            && $job->attachable?->is($this->owner);
    });
    $this->drive->assertNothingCalled();
});

it('rejects uploads above 100 MB before storing anything', function () {
    Queue::fake();
    $file = UploadedFile::fake()->create('besar.zip', 100 * 1024 + 1);

    expect(fn () => app(QueueDriveUpload::class)->handle($this->owner, $file, $this->user))
        ->toThrow(DriveUploadTooLarge::class);

    Queue::assertNothingPushed();
    expect(Storage::disk('local')->allFiles())->toBe([]);
});

it('refuses uploads while Google is off', function () {
    GoogleTesting::disable();

    app(QueueDriveUpload::class)->handle($this->owner, UploadedFile::fake()->create('a.pdf', 1), $this->user);
})->throws(GoogleNotConfigured::class);

it('cleans control characters out of file names', function () {
    expect(QueueDriveUpload::cleanFilename("lap\x00oran/akhir.pdf"))->toBe('lap oran akhir.pdf')
        ->and(QueueDriveUpload::cleanFilename('   '))->toBe('Berkas tanpa nama');
});

it('uploads to the workspace folder, caches the file, attaches it and cleans up', function () {
    Event::fake([DriveFileUploaded::class]);
    $content = random_bytes(600 * 1024);
    $file = UploadedFile::fake()->createWithContent('Wireframe v3.pdf', $content);

    $uploadId = app(QueueDriveUpload::class)->handle($this->owner, $file, $this->user, $this->owner);

    $driveFile = DriveFile::query()->sole();
    $attachment = Attachment::query()->sole();

    expect($driveFile->name)->toBe('Wireframe v3.pdf')
        ->and($driveFile->size_bytes)->toBe(600 * 1024)
        ->and($driveFile->workspace_id)->toBe($this->owner->workspace_id)
        ->and($driveFile->parent_google_id)->toBe($this->owner->fresh()->drive_folder_id)
        ->and($driveFile->added_by)->toBe($this->user->id)
        ->and($this->drive->uploadedContent($driveFile->google_file_id))->toBe($content)
        ->and($attachment->drive_file_id)->toBe($driveFile->id)
        ->and($attachment->attachable_id)->toBe($this->owner->id)
        ->and(Storage::disk('local')->allFiles())->toBe([]);

    Event::assertDispatched(DriveFileUploaded::class, fn (DriveFileUploaded $event) => $event->uploadId === $uploadId
        && $event->file->is($driveFile)
        && $event->attachment?->is($attachment)
        && $event->uploaderId === $this->user->id);
});

it('keeps the temporary file and backs off when Drive is busy', function () {
    Storage::disk('local')->put('drive-uploads/u1/upload.bin', 'abc');
    $this->drive->rateLimitNext('upload.start');

    $job = (new UploadToDrive($this->owner, 'u1', 'local', 'drive-uploads/u1/upload.bin', 'a.txt', 'text/plain', $this->user))
        ->withFakeQueueInteractions();
    app()->call([$job, 'handle']);

    $job->assertReleased(10);
    Storage::disk('local')->assertExists('drive-uploads/u1/upload.bin');
});

it('reports a permanent failure to the uploader and deletes the temporary file', function () {
    Event::fake([DriveUploadFailed::class]);
    Storage::disk('local')->put('drive-uploads/u2/upload.bin', 'abc');
    $this->drive->failNext('upload.start', 403, 'insufficientFilePermissions');

    UploadToDrive::dispatch($this->owner, 'u2', 'local', 'drive-uploads/u2/upload.bin', 'a.txt', 'text/plain', $this->user);

    Storage::disk('local')->assertMissing('drive-uploads/u2/upload.bin');
    expect(DriveFile::query()->count())->toBe(0);
    Event::assertDispatched(DriveUploadFailed::class, fn (DriveUploadFailed $event) => $event->uploadId === 'u2'
        && $event->uploaderId === $this->user->id
        && $event->message === 'Akses ke Google Drive ditolak. Hubungi admin RuangKerja.');
});

it('fails cleanly when Google was switched off after queueing', function () {
    Event::fake([DriveUploadFailed::class]);
    Storage::disk('local')->put('drive-uploads/u3/upload.bin', 'abc');
    GoogleTesting::disable();

    UploadToDrive::dispatch($this->owner, 'u3', 'local', 'drive-uploads/u3/upload.bin', 'a.txt', 'text/plain', $this->user);

    Storage::disk('local')->assertMissing('drive-uploads/u3/upload.bin');
    Event::assertDispatched(DriveUploadFailed::class, fn (DriveUploadFailed $event) => $event->message === 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.');
});
