<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Domain\Google\Services\DriveFileRecorder;
use App\Domain\Google\Services\DriveFolderService;
use App\Domain\Google\Services\GoogleClientFactory;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * "Folder baru" in the File tab: creates a sub-folder in the owner's Drive
 * folder (or in `$parentId`, a sub-folder the caller authorized). Like
 * "Dokumen baru" it runs synchronously with the 10-second timeout because
 * the user opens the new folder right away; access is inherited from the
 * workspace folder.
 */
final class CreateDriveSubfolder
{
    public function __construct(
        private readonly GoogleClientFactory $google,
        private readonly DriveFolderService $folders,
        private readonly DriveFileRecorder $recorder,
    ) {}

    /**
     * @throws DriveRequestFailed|GoogleNotConfigured|LockTimeoutException
     */
    public function handle(Model&HasDriveFolder $owner, string $name, User $user, ?string $parentId = null): DriveFile
    {
        $timeout = $this->google->syncTimeout();
        $root = $this->folders->ensure($owner, $timeout);

        if ($root->needsPermissionSync()) {
            SyncDrivePermissions::dispatch($owner);
        }

        $title = Str::limit(trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $name)), 250, '');
        $parent = $parentId ?? $root->folderId;

        $item = $this->google
            ->serviceAccount($timeout)
            ->createFolder($title === '' ? 'Folder tanpa nama' : $title, $parent);

        return $this->recorder->record($item, $owner->driveWorkspaceId(), $user, $parent);
    }
}
