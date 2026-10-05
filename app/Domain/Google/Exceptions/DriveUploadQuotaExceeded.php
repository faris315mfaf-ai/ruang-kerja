<?php

namespace App\Domain\Google\Exceptions;

/**
 * Per-user cap on open upload sessions / bytes waiting on the server's disk
 * (config google.upload.max_open_sessions, max_pending_bytes).
 */
final class DriveUploadQuotaExceeded extends GoogleException
{
    public function __construct()
    {
        parent::__construct('Too many pending uploads for this user');
    }

    public function userMessage(): string
    {
        return 'Terlalu banyak unggahan yang belum selesai. Tunggu unggahan lain selesai atau batalkan, lalu coba lagi.';
    }

    public function errorCode(): string
    {
        return 'drive_upload_quota';
    }

    public function httpStatus(): int
    {
        return 429;
    }
}
