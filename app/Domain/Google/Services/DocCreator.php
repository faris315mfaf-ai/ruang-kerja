<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Enums\GoogleDocType;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Creates an empty Google Docs/Sheets/Slides file in the owner's folder and
 * caches it in drive_files. Runs synchronously (the user waits to open the
 * new document) with the 10-second sync timeout allowed by AGENTS.md; the
 * folder is created on first use (e.g. personal workspaces).
 */
final class DocCreator
{
    public function __construct(
        private readonly GoogleClientFactory $google,
        private readonly DriveFolderService $folders,
        private readonly DriveFileRecorder $recorder,
    ) {}

    /**
     * @return DriveFile with web_view_link to open in a new tab
     *
     * @throws DriveRequestFailed|GoogleNotConfigured|LockTimeoutException
     */
    public function create(Model&HasDriveFolder $owner, GoogleDocType $type, string $name, User $user): DriveFile
    {
        $timeout = $this->google->syncTimeout();
        $folder = $this->folders->ensure($owner, $timeout);

        if ($folder->needsPermissionSync()) {
            SyncDrivePermissions::dispatch($owner);
        }

        $title = Str::limit(trim($name), 250, '');

        $item = $this->google
            ->serviceAccount($timeout)
            ->createFile($title === '' ? $type->defaultName() : $title, $type->mimeType(), $folder->folderId);

        return $this->recorder->record($item, $owner->driveWorkspaceId(), $user, $folder->folderId);
    }
}
