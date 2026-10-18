<?php

namespace App\Domain\Google\Jobs;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Events\DriveFileUploaded;
use App\Domain\Google\Events\DriveUploadFailed;
use App\Domain\Google\Exceptions\GoogleException;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\Concerns\HandlesGoogleFailures;
use App\Domain\Google\Services\DriveFileRecorder;
use App\Domain\Google\Services\DriveFolderContentsSync;
use App\Domain\Google\Services\DriveFolderService;
use App\Domain\Google\Services\ResumableUploader;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\Attachment;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Streams a temporary upload (stored by QueueDriveUpload or a chunked
 * DriveUploadSession) to the owner's Drive folder — or `$folderId`, a
 * sub-folder of it the caller already authorized — with the resumable protocol, caches it in drive_files,
 * optionally attaches it, then deletes the temporary file. A retried job
 * resumes the same Drive session. Fires DriveFileUploaded / DriveUploadFailed.
 */
final class UploadToDrive implements ShouldQueue
{
    use CompanyAware;
    use HandlesGoogleFailures, Queueable;

    public bool $deleteWhenMissingModels = true;

    /**
     * Worker timeout (seconds) for one attempt of a 100 MB upload.
     */
    public int $timeout = 900;

    public function __construct(
        public Model&HasDriveFolder $owner,
        public string $uploadId,
        public string $disk,
        public string $path,
        public string $filename,
        public string $mimeType,
        public ?User $uploader = null,
        public ?Model $attachable = null,
        public ?string $folderId = null,
    ) {}

    public function handle(
        DriveFolderService $folders,
        ResumableUploader $uploader,
        DriveFileRecorder $recorder,
        DriveFolderContentsSync $contents,
    ): void {
        if (! GoogleFeatures::enabled()) {
            $this->fail(new GoogleNotConfigured(GoogleFeatures::missingDriveSettings()));

            return;
        }

        if (! Storage::disk($this->disk)->exists($this->path)) {
            $this->fail(new RuntimeException("Temporary upload [{$this->uploadId}] is missing."));

            return;
        }

        /** @var array{0: DriveFile, 1: Attachment|null}|null $result */
        $result = $this->runGoogle(function () use ($folders, $uploader, $recorder, $contents): array {
            $folder = $folders->ensure($this->owner);

            if ($folder->needsPermissionSync()) {
                SyncDrivePermissions::dispatch($this->owner);
            }

            $targetId = $this->folderId ?? $folder->folderId;

            $item = $uploader->upload(
                $this->uploadId,
                $targetId,
                Storage::disk($this->disk)->path($this->path),
                $this->filename,
                $this->mimeType,
            );

            $result = DB::transaction(function () use ($recorder, $item, $targetId): array {
                $file = $recorder->record($item, $this->owner->driveWorkspaceId(), $this->uploader, $targetId);
                $attachment = $this->attachable === null ? null : $recorder->attach($file, $this->attachable, $this->uploader);

                return [$file, $attachment];
            });

            $contents->markStale($targetId);

            return $result;
        });

        if ($result === null) {
            return;
        }

        $this->deleteTemporaryFile();

        DriveFileUploaded::dispatch($result[0], $this->uploadId, $this->uploader?->id, $result[1]);
    }

    public function failed(?Throwable $exception): void
    {
        $this->deleteTemporaryFile();

        DriveUploadFailed::dispatch(
            $this->uploadId,
            $this->uploader?->id,
            $this->filename,
            $exception instanceof GoogleException
                ? $exception->userMessage()
                : 'Gagal mengunggah ke Google Drive. Coba unggah ulang.',
        );
    }

    protected function subject(): string
    {
        return $this->owner->driveFolderKey().'#upload:'.$this->uploadId;
    }

    private function deleteTemporaryFile(): void
    {
        $storage = Storage::disk($this->disk);
        $storage->delete($this->path);

        $directory = dirname($this->path);

        if ($directory !== '.' && $storage->files($directory) === []) {
            $storage->deleteDirectory($directory);
        }
    }
}
