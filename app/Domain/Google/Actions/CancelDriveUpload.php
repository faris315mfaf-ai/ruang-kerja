<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Data\DriveUploadSession;
use App\Domain\Google\Services\DriveUploadSessions;

/**
 * "Batalkan" while chunks are still arriving: deletes the temporary file.
 * Uploads already handed to Drive cannot be cancelled.
 */
final class CancelDriveUpload
{
    public function __construct(private readonly DriveUploadSessions $sessions) {}

    public function handle(DriveUploadSession $session): bool
    {
        return $this->sessions->locked($session->id, function () use ($session): bool {
            $current = $this->sessions->find($session->id);

            if ($current === null || $current->state !== DriveUploadSession::RECEIVING) {
                return false;
            }

            $this->sessions->discard($current);

            return true;
        });
    }
}
