<?php

namespace App\Domain\Google\Events;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * An UploadToDrive job gave up. `message` is a friendly Indonesian text.
 */
final class DriveUploadFailed
{
    use Dispatchable;

    public function __construct(
        public string $uploadId,
        public ?string $uploaderId,
        public string $filename,
        public string $message,
    ) {}
}
