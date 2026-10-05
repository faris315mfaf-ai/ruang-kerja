<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Data\DriveUploadSession;
use App\Domain\Google\Exceptions\DriveUploadTooLarge;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Services\DriveUploadSessions;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * "Unggah" (chunked): opens an upload session for a file of up to 100 MB
 * that will land in the owner's Drive folder (or `$folderId`, a sub-folder
 * the caller authorized) and optionally be attached to `$attachable`.
 * Authorize first (DriveFilePolicy::create or AttachmentPolicy::create).
 */
final class StartDriveUpload
{
    public function __construct(private readonly DriveUploadSessions $sessions) {}

    /**
     * @throws DriveUploadTooLarge|GoogleNotConfigured
     */
    public function handle(
        Model&HasDriveFolder $owner,
        User $user,
        string $filename,
        int $size,
        string $mimeType,
        ?string $folderId = null,
        ?Model $attachable = null,
    ): DriveUploadSession {
        GoogleFeatures::ensureEnabled();

        if ($size > GoogleFeatures::maxUploadBytes()) {
            throw new DriveUploadTooLarge($size);
        }

        $key = $owner->getKey();
        $attachableKey = $attachable?->getKey();

        return $this->sessions->create(
            userId: $user->id,
            ownerType: $owner::class,
            ownerId: is_scalar($key) ? (string) $key : '',
            workspaceId: $owner->driveWorkspaceId(),
            folderId: $folderId,
            attachableType: $attachable === null ? null : $attachable::class,
            attachableId: is_scalar($attachableKey) ? (string) $attachableKey : null,
            filename: QueueDriveUpload::cleanFilename($filename),
            mimeType: trim($mimeType) === '' ? 'application/octet-stream' : trim($mimeType),
            size: $size,
        );
    }
}
