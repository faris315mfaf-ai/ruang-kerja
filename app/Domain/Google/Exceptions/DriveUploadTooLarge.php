<?php

namespace App\Domain\Google\Exceptions;

use App\Domain\Google\GoogleFeatures;

final class DriveUploadTooLarge extends GoogleException
{
    public function __construct(public readonly int $size)
    {
        parent::__construct("Upload of {$size} bytes exceeds the limit");
    }

    public function userMessage(): string
    {
        $megabytes = intdiv(GoogleFeatures::maxUploadBytes(), 1024 * 1024);

        return "Ukuran file maksimal {$megabytes} MB.";
    }

    public function errorCode(): string
    {
        return 'drive_upload_too_large';
    }

    public function httpStatus(): int
    {
        return 422;
    }
}
