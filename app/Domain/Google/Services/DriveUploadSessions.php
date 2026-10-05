<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Data\DriveUploadSession;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Browser → server chunked uploads. A file of up to 100 MB arrives in
 * chunks small enough for PHP's upload_max_filesize/post_max_size (Herd
 * ships 2 MB); the server appends them to a private temporary file and,
 * once complete, UploadToDrive streams it to Drive. The browser can resume
 * an interrupted upload from `received`. Sessions live in the cache for a
 * day; `ruangkerja:drive-uploads:prune` removes abandoned temporary files.
 */
final class DriveUploadSessions
{
    private const int TTL_HOURS = 24;

    private const int MIN_CHUNK = 256 * 1024;

    private const int MARGIN = 128 * 1024;

    /**
     * Writes a new session and its empty temporary file.
     */
    public function create(
        string $userId,
        string $ownerType,
        string $ownerId,
        string $workspaceId,
        ?string $folderId,
        ?string $attachableType,
        ?string $attachableId,
        string $filename,
        string $mimeType,
        int $size,
    ): DriveUploadSession {
        $id = strtolower((string) Str::ulid());
        $disk = (string) config('google.upload.disk', 'local');
        $path = trim((string) config('google.upload.directory', 'drive-uploads'), '/').'/'.$id.'/upload.bin';

        if (! Storage::disk($disk)->put($path, '')) {
            throw new RuntimeException('The temporary upload could not be created.');
        }

        $session = new DriveUploadSession(
            id: $id,
            userId: $userId,
            ownerType: $ownerType,
            ownerId: $ownerId,
            workspaceId: $workspaceId,
            folderId: $folderId,
            attachableType: $attachableType,
            attachableId: $attachableId,
            filename: $filename,
            mimeType: $mimeType,
            size: $size,
            disk: $disk,
            path: $path,
        );

        $this->save($session);

        return $session;
    }

    public function find(string $id): ?DriveUploadSession
    {
        if (preg_match('/^[0-9a-z]{26}$/', $id) !== 1) {
            return null;
        }

        $data = Cache::get($this->key($id));

        return is_array($data) ? DriveUploadSession::fromArray($data) : null;
    }

    public function save(DriveUploadSession $session): void
    {
        Cache::put($this->key($session->id), $session->toArray(), now()->addHours(self::TTL_HOURS));
    }

    /**
     * Runs $callback while holding the session lock (chunks of one upload never interleave).
     *
     * @template TResult
     *
     * @param  callable(): TResult  $callback
     * @return TResult
     */
    public function locked(string $id, callable $callback): mixed
    {
        return Cache::lock('google:upload-session-lock:'.$id, 60)->block(15, $callback);
    }

    /**
     * Appends bytes to the temporary file; the caller checked the offset.
     */
    public function appendBytes(DriveUploadSession $session, string $bytes): void
    {
        $handle = @fopen(Storage::disk($session->disk)->path($session->path), 'ab');

        if ($handle === false) {
            throw new RuntimeException("Temporary upload [{$session->id}] is missing.");
        }

        try {
            if (fwrite($handle, $bytes) !== strlen($bytes)) {
                throw new RuntimeException("Temporary upload [{$session->id}] could not be written.");
            }
        } finally {
            fclose($handle);
        }

        $session->received += strlen($bytes);
    }

    /**
     * Cancels a session: forgets it and deletes the temporary file.
     */
    public function discard(DriveUploadSession $session): void
    {
        Cache::forget($this->key($session->id));

        $storage = Storage::disk($session->disk);
        $storage->deleteDirectory(dirname($session->path));
    }

    /**
     * Updates the state of a session by upload id (no-op for unknown ids,
     * e.g. single-request uploads queued by QueueDriveUpload).
     *
     * @param  callable(DriveUploadSession): void  $change
     */
    public function update(string $id, callable $change): void
    {
        $session = $this->find($id);

        if ($session === null) {
            return;
        }

        $change($session);
        $this->save($session);
    }

    /**
     * Largest chunk the browser may send: below PHP's upload and POST limits
     * (minus room for the multipart envelope), between 256 KiB and
     * google.upload.chunk_bytes.
     */
    public static function chunkBytes(): int
    {
        $limits = array_filter([
            self::iniBytes((string) ini_get('upload_max_filesize')),
            self::iniBytes((string) ini_get('post_max_size')),
        ], fn (int $bytes): bool => $bytes > 0);

        $max = (int) config('google.upload.chunk_bytes', 8 * 1024 * 1024);
        $limit = $limits === [] ? $max : min($limits) - self::MARGIN;

        return max(self::MIN_CHUNK, min($max, $limit));
    }

    /**
     * "2M" → 2097152; "0"/"" (unlimited/unknown) → 0.
     */
    public static function iniBytes(string $value): int
    {
        $value = trim($value);

        if ($value === '' || ! is_numeric(rtrim($value, 'kKmMgG'))) {
            return 0;
        }

        $number = (int) $value;

        return match (strtolower(substr($value, -1))) {
            'g' => $number * 1024 * 1024 * 1024,
            'm' => $number * 1024 * 1024,
            'k' => $number * 1024,
            default => $number,
        };
    }

    private function key(string $id): string
    {
        return 'google:upload-session:'.$id;
    }
}
