<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Exceptions\GoogleNotConnected;
use App\Domain\Google\Exceptions\GoogleReconnectRequired;
use App\Domain\Google\Services\DriveFileImporter;
use App\Domain\Google\Services\DriveFileRecorder;
use App\Models\Attachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * "Pilih dari Drive": the Picker returns a file id; fetch its metadata with
 * the user's token, cache it in drive_files and attach it (idempotent).
 * Authorize first (e.g. Gate::authorize('update', $task)).
 */
final class AttachDriveFile
{
    public function __construct(
        private readonly DriveFileImporter $importer,
        private readonly DriveFileRecorder $recorder,
    ) {}

    /**
     * @throws DriveRequestFailed|GoogleNotConfigured|GoogleNotConnected|GoogleReconnectRequired|ValidationException
     */
    public function handle(User $user, Model $attachable, string $workspaceId, string $googleFileId): Attachment
    {
        try {
            $file = $this->importer->import($user, $workspaceId, $googleFileId);
        } catch (InvalidArgumentException) {
            throw ValidationException::withMessages(['file_id' => 'File Drive tidak valid.']);
        }

        return $this->recorder->attach($file, $attachable, $user);
    }
}
