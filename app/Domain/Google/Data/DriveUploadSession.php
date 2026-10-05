<?php

namespace App\Domain\Google\Data;

/**
 * A browser → server chunked upload on its way to Drive (cached by
 * DriveUploadSessions). States: receiving (chunks arriving) → processing
 * (UploadToDrive queued) → done | failed.
 */
final class DriveUploadSession
{
    public const string RECEIVING = 'receiving';

    public const string PROCESSING = 'processing';

    public const string DONE = 'done';

    public const string FAILED = 'failed';

    /**
     * @param  string  $ownerType  HasDriveFolder model class (e.g. App\Models\Workspace)
     * @param  string|null  $attachableType  attachable model class (e.g. App\Models\Task)
     */
    public function __construct(
        public readonly string $id,
        public readonly string $userId,
        public readonly string $ownerType,
        public readonly string $ownerId,
        public readonly string $workspaceId,
        public readonly ?string $folderId,
        public readonly ?string $attachableType,
        public readonly ?string $attachableId,
        public readonly string $filename,
        public readonly string $mimeType,
        public readonly int $size,
        public readonly string $disk,
        public readonly string $path,
        public int $received = 0,
        public string $state = self::RECEIVING,
        public ?string $driveFileId = null,
        public ?string $attachmentId = null,
        public ?string $message = null,
    ) {}

    public function isComplete(): bool
    {
        return $this->received >= $this->size;
    }

    /**
     * @return array<string, string|int|null>
     */
    public function toArray(): array
    {
        return get_object_vars($this);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            id: (string) $data['id'],
            userId: (string) $data['userId'],
            ownerType: (string) $data['ownerType'],
            ownerId: (string) $data['ownerId'],
            workspaceId: (string) $data['workspaceId'],
            folderId: self::nullableString($data['folderId'] ?? null),
            attachableType: self::nullableString($data['attachableType'] ?? null),
            attachableId: self::nullableString($data['attachableId'] ?? null),
            filename: (string) $data['filename'],
            mimeType: (string) $data['mimeType'],
            size: (int) $data['size'],
            disk: (string) $data['disk'],
            path: (string) $data['path'],
            received: (int) ($data['received'] ?? 0),
            state: (string) ($data['state'] ?? self::RECEIVING),
            driveFileId: self::nullableString($data['driveFileId'] ?? null),
            attachmentId: self::nullableString($data['attachmentId'] ?? null),
            message: self::nullableString($data['message'] ?? null),
        );
    }

    /**
     * JSON for the uploader's browser (no paths).
     *
     * @return array{id: string, filename: string, size: int, received: int, state: string, drive_file_id: string|null, attachment_id: string|null, message: string|null}
     */
    public function publicData(): array
    {
        return [
            'id' => $this->id,
            'filename' => $this->filename,
            'size' => $this->size,
            'received' => $this->received,
            'state' => $this->state,
            'drive_file_id' => $this->driveFileId,
            'attachment_id' => $this->attachmentId,
            'message' => $this->message,
        ];
    }

    private static function nullableString(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }
}
