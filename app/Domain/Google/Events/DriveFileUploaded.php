<?php

namespace App\Domain\Google\Events;

use App\Models\Attachment;
use App\Models\DriveFile;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * An UploadToDrive job finished. Part B can broadcast it to the uploader
 * (toast "File terunggah") and refresh the File tab.
 */
final class DriveFileUploaded
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public DriveFile $file,
        public string $uploadId,
        public ?string $uploaderId = null,
        public ?Attachment $attachment = null,
    ) {}
}
