<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Contracts\DriveClient;
use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Data\DriveItem;
use App\Domain\Google\Data\FolderResult;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Creates (once) the Shared Drive folder of a HasDriveFolder owner.
 *
 * Idempotent: a stored id is verified first; when it is missing or gone, a
 * folder tagged with appProperties.rk_owner = owner key is looked up (a job
 * that died after creating it) before a new one is created. A cache lock per
 * owner prevents two workers from creating twice. Renames the folder when
 * the owner's name changed.
 */
final class DriveFolderService
{
    public const string OWNER_PROPERTY = 'rk_owner';

    public function __construct(private readonly GoogleClientFactory $google) {}

    /**
     * @param  int|null  $timeout  HTTP timeout (seconds); null = job default
     *
     * @throws DriveRequestFailed|GoogleNotConfigured|LockTimeoutException
     */
    public function ensure(HasDriveFolder $owner, ?int $timeout = null): FolderResult
    {
        $drive = $this->google->serviceAccount($timeout);

        return Cache::lock('google:folder:'.sha1($owner->driveFolderKey()), 60)
            ->block(15, fn (): FolderResult => $this->ensureLocked($drive, $owner));
    }

    private function ensureLocked(DriveClient $drive, HasDriveFolder $owner): FolderResult
    {
        $name = $owner->driveFolderName();
        $storedId = $owner->driveFolderId();

        if ($storedId !== null) {
            $existing = $this->find($drive, $storedId);

            if ($existing !== null) {
                return new FolderResult($existing->id, renamed: $this->renameIfNeeded($drive, $existing, $name));
            }

            Log::warning('google.folder.missing', ['owner' => $owner->driveFolderKey(), 'folder_id' => $storedId]);
        }

        $sharedDriveId = $this->google->sharedDriveId();
        $orphan = $drive->findFolderByAppProperty(self::OWNER_PROPERTY, $owner->driveFolderKey(), $sharedDriveId);

        if ($orphan !== null) {
            $owner->storeDriveFolderId($orphan->id);
            Log::info('google.folder.recovered', ['owner' => $owner->driveFolderKey(), 'folder_id' => $orphan->id]);

            return new FolderResult($orphan->id, renamed: $this->renameIfNeeded($drive, $orphan, $name), recovered: true);
        }

        $folder = $drive->createFolder(
            $name,
            $owner->driveParentFolderId() ?? $sharedDriveId,
            [self::OWNER_PROPERTY => $owner->driveFolderKey()],
        );

        $owner->storeDriveFolderId($folder->id);
        Log::info('google.folder.created', ['owner' => $owner->driveFolderKey(), 'folder_id' => $folder->id]);

        return new FolderResult($folder->id, created: true);
    }

    /**
     * The folder, or null when it was deleted, trashed or is not visible.
     */
    private function find(DriveClient $drive, string $folderId): ?DriveItem
    {
        try {
            $item = $drive->getFile($folderId);
        } catch (DriveRequestFailed $exception) {
            if ($exception->isNotFound()) {
                return null;
            }

            throw $exception;
        }

        return $item->trashed || ! $item->isFolder() ? null : $item;
    }

    private function renameIfNeeded(DriveClient $drive, DriveItem $folder, string $name): bool
    {
        if ($folder->name === $name) {
            return false;
        }

        $drive->rename($folder->id, $name);

        return true;
    }
}
