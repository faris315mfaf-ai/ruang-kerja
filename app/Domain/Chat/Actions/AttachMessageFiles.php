<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Queries\AttachableDriveFiles;
use App\Domain\Google\Enums\AttachmentSource;
use App\Models\Channel;
use App\Models\DriveFile;
use App\Models\Message;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Links Drive files (already cached in drive_files) to a message. Decision
 * 6 Oct 2026: allowed in any channel, but only files every reader of the
 * channel can open (AttachableDriveFiles), so attaching never widens access.
 */
final class AttachMessageFiles
{
    public const int MAX_FILES = 10;

    public function __construct(private readonly AttachableDriveFiles $attachable) {}

    /**
     * @param  list<string>  $driveFileIds
     */
    public function handle(Channel $channel, Message $message, User $actor, array $driveFileIds): void
    {
        $driveFileIds = array_values(array_unique($driveFileIds));

        if ($driveFileIds === []) {
            return;
        }

        if (count($driveFileIds) > self::MAX_FILES) {
            throw ValidationException::withMessages(['attachments' => 'Maksimal '.self::MAX_FILES.' lampiran per pesan.']);
        }

        $files = $this->attachable->query($channel, $actor)->whereIn('drive_files.id', $driveFileIds)->get();

        if ($files->count() !== count($driveFileIds)) {
            throw ValidationException::withMessages([
                'attachments' => 'Ada file yang tidak bisa dibuka semua anggota obrolan ini. Bagikan file dari workspace yang sama-sama mereka ikuti.',
            ]);
        }

        foreach ($files as $file) {
            /** @var DriveFile $file */
            $message->attachments()->create([
                'source' => AttachmentSource::Drive,
                'drive_file_id' => $file->id,
                'filename' => $file->name,
                'mime_type' => $file->mime_type,
                'size_bytes' => $file->size_bytes,
                'uploaded_by' => $actor->id,
            ]);
        }
    }
}
