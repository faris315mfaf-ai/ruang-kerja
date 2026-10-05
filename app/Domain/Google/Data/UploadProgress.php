<?php

namespace App\Domain\Google\Data;

/**
 * State of a resumable upload session after a chunk or status query.
 */
final readonly class UploadProgress
{
    public function __construct(
        public bool $complete,
        public int $nextOffset,
        public ?DriveItem $item = null,
    ) {}

    public static function incomplete(int $nextOffset): self
    {
        return new self(false, $nextOffset);
    }

    public static function completed(DriveItem $item, int $size): self
    {
        return new self(true, $size, $item);
    }
}
