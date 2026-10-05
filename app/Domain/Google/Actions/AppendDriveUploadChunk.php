<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Data\DriveUploadSession;
use App\Domain\Google\Jobs\UploadToDrive;
use App\Domain\Google\Services\DriveUploadSessions;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Appends one chunk to a chunked upload. A chunk whose offset does not match
 * the bytes already received is ignored (the caller answers 409 with
 * `received` so the browser resumes from there). The last chunk queues
 * UploadToDrive; the session then moves to `processing`.
 */
final class AppendDriveUploadChunk
{
    public function __construct(private readonly DriveUploadSessions $sessions) {}

    /**
     * @return DriveUploadSession the session after this chunk
     *
     * @throws ValidationException|LockTimeoutException
     */
    public function handle(DriveUploadSession $session, int $offset, string $bytes): DriveUploadSession
    {
        $queue = $this->sessions->locked($session->id, function () use ($session, $offset, $bytes): ?DriveUploadSession {
            $current = $this->sessions->find($session->id);

            if ($current === null || $current->state !== DriveUploadSession::RECEIVING || $offset !== $current->received) {
                return null;
            }

            if ($bytes === '' || $current->received + strlen($bytes) > $current->size) {
                throw ValidationException::withMessages(['chunk' => 'Potongan file tidak sesuai ukuran file.']);
            }

            $this->sessions->appendBytes($current, $bytes);

            if ($current->isComplete()) {
                $current->state = DriveUploadSession::PROCESSING;
            }

            $this->sessions->save($current);

            return $current->state === DriveUploadSession::PROCESSING ? $current : null;
        });

        if ($queue !== null) {
            $this->queue($queue);
        }

        return $this->sessions->find($session->id) ?? $session;
    }

    /**
     * Saved before dispatching: a sync queue (tests) finishes the upload
     * inside dispatch() and its listener writes the final state.
     */
    private function queue(DriveUploadSession $session): void
    {
        $owner = $this->model($session->ownerType, $session->ownerId);
        $uploader = User::query()->find($session->userId);
        $attachable = $session->attachableType !== null && $session->attachableId !== null
            ? $this->model($session->attachableType, $session->attachableId)
            : null;

        if (! $owner instanceof HasDriveFolder || ($session->attachableType !== null && $attachable === null)) {
            $this->sessions->update($session->id, function (DriveUploadSession $failed): void {
                $failed->state = DriveUploadSession::FAILED;
                $failed->message = 'Tujuan unggahan sudah tidak ada.';
            });

            return;
        }

        UploadToDrive::dispatch(
            $owner,
            $session->id,
            $session->disk,
            $session->path,
            $session->filename,
            $session->mimeType,
            $uploader,
            $attachable,
            $session->folderId,
        );
    }

    private function model(string $class, string $id): ?Model
    {
        if (! is_a($class, Model::class, true)) {
            return null;
        }

        return $class::query()->find($id);
    }
}
