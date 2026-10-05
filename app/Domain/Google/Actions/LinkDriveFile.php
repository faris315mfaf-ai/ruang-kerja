<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Exceptions\GoogleNotConnected;
use App\Domain\Google\Exceptions\GoogleReconnectRequired;
use App\Domain\Google\Services\DriveFileImporter;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * "Lampirkan dari Drive" in the File tab: records a file the user picked
 * with Google Picker (their own token) in the workspace's drive_files so it
 * is listed with the folder ("Ditautkan"). The file stays where it is in
 * Drive; who can open it depends on its own Drive sharing.
 * Authorize first: Gate::authorize('create', [DriveFile::class, $workspaceId]).
 */
final class LinkDriveFile
{
    public function __construct(private readonly DriveFileImporter $importer) {}

    /**
     * @throws DriveRequestFailed|GoogleNotConfigured|GoogleNotConnected|GoogleReconnectRequired|ValidationException
     */
    public function handle(User $user, string $workspaceId, string $googleFileId): DriveFile
    {
        try {
            return $this->importer->import($user, $workspaceId, $googleFileId);
        } catch (InvalidArgumentException) {
            throw ValidationException::withMessages(['file_ids' => 'File Drive tidak valid.']);
        }
    }
}
