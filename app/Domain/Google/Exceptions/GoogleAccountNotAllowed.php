<?php

namespace App\Domain\Google\Exceptions;

/**
 * The Google account used for OAuth is outside GOOGLE_ALLOWED_DOMAIN.
 */
final class GoogleAccountNotAllowed extends GoogleException
{
    public function __construct(public readonly string $domain)
    {
        parent::__construct('Google account outside the allowed domain');
    }

    public function userMessage(): string
    {
        return "Gunakan akun Google kantor (@{$this->domain}).";
    }

    public function errorCode(): string
    {
        return 'google_account_not_allowed';
    }

    public function httpStatus(): int
    {
        return 422;
    }
}
