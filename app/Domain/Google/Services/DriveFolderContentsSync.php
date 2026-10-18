<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Models\DriveFile;
use App\Models\Workspace;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Refreshes the drive_files cache for one folder level: upserts the
 * folder's children and soft-deletes cached rows that disappeared from
 * Drive. Callers refresh when isStale() (older than
 * google.folders.stale_after_minutes) — the "File" tab syncs on open.
 */
final class DriveFolderContentsSync
{
    public function __construct(
        private readonly GoogleClientFactory $google,
        private readonly DriveFileRecorder $recorder,
    ) {}

    /**
     * @return int number of children now cached
     *
     * @throws DriveRequestFailed|GoogleNotConfigured
     */
    public function sync(string $workspaceId, string $folderId, ?int $timeout = null): int
    {
        $companyId = Workspace::query()->withTrashed()->whereKey($workspaceId)->value('company_id');
        $companyId = is_string($companyId) ? $companyId : null;
        $items = $this->google->serviceAccount($timeout, $companyId)->listChildren($folderId, $this->google->sharedDriveId($companyId));

        DB::transaction(function () use ($items, $workspaceId, $folderId): void {
            foreach ($items as $item) {
                $this->recorder->record($item, $workspaceId, null, $folderId);
            }

            DriveFile::query()
                ->where('workspace_id', $workspaceId)
                ->where('parent_google_id', $folderId)
                ->whereNotIn('google_file_id', array_map(fn ($item): string => $item->id, $items))
                ->delete();
        });

        Cache::put($this->key($folderId), now()->getTimestamp(), now()->addDay());

        return count($items);
    }

    public function isStale(string $folderId): bool
    {
        $syncedAt = Cache::get($this->key($folderId));
        $maxAge = (int) config('google.folders.stale_after_minutes', 5) * 60;

        // The Redis store may hand integers back as strings.
        return ! is_numeric($syncedAt) || now()->getTimestamp() - (int) $syncedAt > $maxAge;
    }

    /**
     * Forces the next isStale() to return true (e.g. after an upload).
     */
    public function markStale(string $folderId): void
    {
        Cache::forget($this->key($folderId));
    }

    private function key(string $folderId): string
    {
        return 'google:folder-synced:'.sha1($folderId);
    }
}
