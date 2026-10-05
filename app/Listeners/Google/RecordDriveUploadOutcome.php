<?php

namespace App\Listeners\Google;

use App\Domain\Google\Data\DriveUploadSession;
use App\Domain\Google\Events\DriveFileUploaded;
use App\Domain\Google\Events\DriveUploadFailed;
use App\Domain\Google\Services\DriveUploadSessions;

/**
 * Marks a chunked upload session done/failed when UploadToDrive finishes,
 * so the uploader's browser (polling the session) can refresh the list.
 */
final class RecordDriveUploadOutcome
{
    public function __construct(private readonly DriveUploadSessions $sessions) {}

    public function handleUploaded(DriveFileUploaded $event): void
    {
        $this->sessions->update($event->uploadId, function (DriveUploadSession $session) use ($event): void {
            $session->state = DriveUploadSession::DONE;
            $session->driveFileId = $event->file->id;
            $session->attachmentId = $event->attachment?->id;
        });
    }

    public function handleFailed(DriveUploadFailed $event): void
    {
        $this->sessions->update($event->uploadId, function (DriveUploadSession $session) use ($event): void {
            $session->state = DriveUploadSession::FAILED;
            $session->message = $event->message;
        });
    }
}
