<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Data\DriveItem;
use App\Domain\Google\Data\UploadProgress;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\DriveUploadTooLarge;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\GoogleFeatures;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use RuntimeException;

/**
 * Drive resumable upload (≤ google.upload.max_bytes) of a local file in
 * chunks. The session URI is cached (encrypted) per upload id, so a retried
 * job resumes from the last byte Drive acknowledged instead of starting
 * over. An expired session is reported as retryable so the job restarts it.
 */
final class ResumableUploader
{
    private const int CHUNK_UNIT = 256 * 1024;

    public function __construct(private readonly GoogleClientFactory $google) {}

    /**
     * @throws DriveRequestFailed|DriveUploadTooLarge|GoogleNotConfigured
     */
    public function upload(string $uploadId, string $folderId, string $path, string $name, string $mimeType): DriveItem
    {
        $size = @filesize($path);

        if ($size === false) {
            throw new RuntimeException("Upload source for [{$uploadId}] is missing.");
        }

        if ($size > GoogleFeatures::maxUploadBytes()) {
            throw new DriveUploadTooLarge($size);
        }

        $drive = $this->google->serviceAccount();
        $session = $this->cachedSession($uploadId);
        $offset = 0;

        if ($session !== null) {
            try {
                $status = $drive->uploadStatus($session, $size);

                if ($status->complete && $status->item !== null) {
                    $this->forgetSession($uploadId);

                    return $status->item;
                }

                $offset = $status->nextOffset;
            } catch (DriveRequestFailed $exception) {
                if (! $this->sessionGone($exception)) {
                    throw $exception;
                }

                $session = null;
            }
        }

        if ($session === null) {
            $session = $drive->startResumableUpload($name, $mimeType, $size, $folderId);
            Cache::put($this->key($uploadId), Crypt::encryptString($session), now()->addDays(6));
        }

        $progress = $this->sendChunks($uploadId, $session, $path, $offset, $size);
        $this->forgetSession($uploadId);

        if ($progress->item === null) {
            throw new DriveRequestFailed('upload.chunk', 500, 'missingMetadata');
        }

        return $progress->item;
    }

    public function chunkSize(): int
    {
        $configured = (int) config('google.upload.chunk_bytes', 8 * 1024 * 1024);

        return max(self::CHUNK_UNIT, intdiv($configured, self::CHUNK_UNIT) * self::CHUNK_UNIT);
    }

    /**
     * @throws DriveRequestFailed
     */
    private function sendChunks(string $uploadId, string $session, string $path, int $offset, int $size): UploadProgress
    {
        $drive = $this->google->serviceAccount();
        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException("Upload source for [{$uploadId}] cannot be read.");
        }

        try {
            while (true) {
                $bytes = '';

                if ($size > 0) {
                    fseek($handle, $offset);
                    $bytes = (string) fread($handle, max(1, min($this->chunkSize(), $size - $offset)));
                }

                try {
                    $progress = $drive->uploadChunk($session, $bytes, $offset, $size);
                } catch (DriveRequestFailed $exception) {
                    if ($this->sessionGone($exception)) {
                        $this->forgetSession($uploadId);

                        // Retryable: the job starts a fresh session on its next attempt.
                        throw new DriveRequestFailed('upload.chunk', 503, 'uploadSessionExpired');
                    }

                    throw $exception;
                }

                if ($progress->complete) {
                    return $progress;
                }

                if ($progress->nextOffset <= $offset) {
                    throw new DriveRequestFailed('upload.chunk', 503, 'noProgress');
                }

                $offset = $progress->nextOffset;
            }
        } finally {
            fclose($handle);
        }
    }

    private function cachedSession(string $uploadId): ?string
    {
        $value = Cache::get($this->key($uploadId));

        if (! is_string($value)) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return null;
        }
    }

    private function forgetSession(string $uploadId): void
    {
        Cache::forget($this->key($uploadId));
    }

    private function sessionGone(DriveRequestFailed $exception): bool
    {
        return in_array($exception->status, [404, 410], true);
    }

    private function key(string $uploadId): string
    {
        return 'google:upload-session:'.$uploadId;
    }
}
