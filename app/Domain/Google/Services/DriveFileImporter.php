<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Exceptions\GoogleNotConnected;
use App\Domain\Google\Exceptions\GoogleReconnectRequired;
use App\Models\DriveFile;
use App\Models\User;
use InvalidArgumentException;

/**
 * Fetches metadata of files the user picked with Google Picker, using the
 * user's own token (drive.file grants access to exactly the picked files),
 * and caches it in drive_files. Synchronous with the 10-second timeout: the
 * user waits for the attachment to appear.
 */
final class DriveFileImporter
{
    public function __construct(
        private readonly GoogleClientFactory $google,
        private readonly DriveFileRecorder $recorder,
    ) {}

    /**
     * @throws DriveRequestFailed|GoogleNotConfigured|GoogleNotConnected|GoogleReconnectRequired|InvalidArgumentException
     */
    public function import(User $user, string $workspaceId, string $googleFileId): DriveFile
    {
        if (! self::isValidFileId($googleFileId)) {
            throw new InvalidArgumentException('Invalid Drive file id.');
        }

        $item = $this->google
            ->forUser($user, $this->google->syncTimeout())
            ->getFile($googleFileId);

        return $this->recorder->record($item, $workspaceId, $user);
    }

    /**
     * Drive ids are URL-safe base64-ish strings.
     */
    public static function isValidFileId(string $id): bool
    {
        return preg_match('/^[A-Za-z0-9_-]{10,200}$/', $id) === 1;
    }
}
