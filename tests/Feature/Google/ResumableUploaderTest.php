<?php

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\DriveUploadTooLarge;
use App\Domain\Google\Services\ResumableUploader;
use App\Domain\Google\Testing\FakeDriveClient;

beforeEach(function () {
    $this->drive = FakeDriveClient::fake();
    $this->folder = $this->drive->seedFolder('Proyek')->id;
    config(['google.upload.chunk_bytes' => 256 * 1024]);

    $this->path = tempnam(sys_get_temp_dir(), 'upl');
    $this->content = random_bytes(600 * 1024);
    file_put_contents($this->path, $this->content);
});

afterEach(function () {
    @unlink($this->path);
});

it('uploads a file in 256 KiB chunks into the folder', function () {
    $item = app(ResumableUploader::class)->upload('up-1', $this->folder, $this->path, 'Wireframe v3.pdf', 'application/pdf');

    expect($item->name)->toBe('Wireframe v3.pdf')
        ->and($item->size)->toBe(600 * 1024)
        ->and($item->parents)->toBe([$this->folder])
        ->and($this->drive->uploadedContent($item->id))->toBe($this->content);

    $this->drive->assertCalled('upload.start', 1);
    $this->drive->assertCalled('upload.chunk', 3);
});

it('resumes the same session after a failed chunk instead of starting over', function () {
    $this->drive->failNext('upload.chunk', 503, 'backendError', when: fn ($arguments) => $arguments['offset'] === 256 * 1024);
    $uploader = app(ResumableUploader::class);

    expect(fn () => $uploader->upload('up-2', $this->folder, $this->path, 'a.bin', 'application/octet-stream'))
        ->toThrow(DriveRequestFailed::class);

    $item = $uploader->upload('up-2', $this->folder, $this->path, 'a.bin', 'application/octet-stream');

    expect($this->drive->uploadedContent($item->id))->toBe($this->content);
    $this->drive->assertCalled('upload.start', 1);
    $this->drive->assertCalled('upload.status', 1);
    expect(array_column(array_column($this->drive->calls('upload.chunk'), 'arguments'), 'offset'))
        ->toBe([0, 262144, 262144, 524288]);
});

it('restarts with a new session when the old one expired', function () {
    $this->drive->failNext('upload.chunk', 503, when: fn ($arguments) => $arguments['offset'] === 256 * 1024);
    $uploader = app(ResumableUploader::class);

    try {
        $uploader->upload('up-3', $this->folder, $this->path, 'a.bin', 'application/octet-stream');
    } catch (DriveRequestFailed) {
    }

    $session = $this->drive->calls('upload.chunk')[0]['arguments']['session'];
    $this->drive->expireUploadSession($session);

    $item = $uploader->upload('up-3', $this->folder, $this->path, 'a.bin', 'application/octet-stream');

    expect($this->drive->uploadedContent($item->id))->toBe($this->content);
    $this->drive->assertCalled('upload.start', 2);
});

it('reports an expired session mid-upload as retryable', function () {
    $this->drive->failNext('upload.chunk', 404, 'notFound');

    try {
        app(ResumableUploader::class)->upload('up-4', $this->folder, $this->path, 'a.bin', 'application/octet-stream');
        $this->fail('Expected DriveRequestFailed.');
    } catch (DriveRequestFailed $exception) {
        expect($exception->reason)->toBe('uploadSessionExpired')
            ->and($exception->isRetryable())->toBeTrue();
    }
});

it('rejects files above the 100 MB limit', function () {
    config(['google.upload.max_bytes' => 1024]);

    try {
        app(ResumableUploader::class)->upload('up-5', $this->folder, $this->path, 'a.bin', 'application/octet-stream');
        $this->fail('Expected DriveUploadTooLarge.');
    } catch (DriveUploadTooLarge $exception) {
        expect($exception->userMessage())->toBe('Ukuran file maksimal 0 MB.');
    }

    config(['google.upload.max_bytes' => 100 * 1024 * 1024]);
    expect((new DriveUploadTooLarge(1))->userMessage())->toBe('Ukuran file maksimal 100 MB.');
    $this->drive->assertNotCalled('upload.start');
});

it('uploads empty files', function () {
    file_put_contents($this->path, '');

    $item = app(ResumableUploader::class)->upload('up-6', $this->folder, $this->path, 'kosong.txt', 'text/plain');

    expect($item->size)->toBe(0);
});

it('rounds the chunk size to the 256 KiB unit Drive requires', function (int $configured, int $expected) {
    config(['google.upload.chunk_bytes' => $configured]);

    expect(app(ResumableUploader::class)->chunkSize())->toBe($expected);
})->with([
    [8 * 1024 * 1024, 8 * 1024 * 1024],
    [300 * 1024, 256 * 1024],
    [1, 256 * 1024],
]);
