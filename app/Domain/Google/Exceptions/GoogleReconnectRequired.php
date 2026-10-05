<?php

namespace App\Domain\Google\Exceptions;

/**
 * The stored refresh token was revoked or expired (invalid_grant).
 */
final class GoogleReconnectRequired extends GoogleException
{
    public function __construct()
    {
        parent::__construct('Google authorization expired, reconnect required');
    }

    public function userMessage(): string
    {
        return 'Sambungan Google Anda kedaluwarsa. Hubungkan ulang akun Google Anda.';
    }

    public function errorCode(): string
    {
        return 'google_reconnect_required';
    }
}
