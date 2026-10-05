<?php

namespace App\Domain\Google\Exceptions;

/**
 * The user has not connected a Google account with the drive.file scope.
 */
final class GoogleNotConnected extends GoogleException
{
    public function __construct()
    {
        parent::__construct('Google account is not connected');
    }

    public function userMessage(): string
    {
        return 'Hubungkan akun Google Anda dulu untuk memilih file dari Drive.';
    }

    public function errorCode(): string
    {
        return 'google_not_connected';
    }
}
