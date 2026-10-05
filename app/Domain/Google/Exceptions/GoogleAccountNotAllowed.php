<?php

namespace App\Domain\Google\Exceptions;

/**
 * The Google account used for OAuth is outside GOOGLE_ALLOWED_DOMAIN, or is
 * not the employee's own Workspace identity (`expectedEmail` set).
 */
final class GoogleAccountNotAllowed extends GoogleException
{
    public function __construct(public readonly string $domain, public readonly ?string $expectedEmail = null)
    {
        parent::__construct($expectedEmail === null
            ? 'Google account outside the allowed domain'
            : 'Google account does not belong to the signed-in employee');
    }

    public static function notOwnAccount(string $domain, string $expectedEmail): self
    {
        return new self($domain, $expectedEmail);
    }

    public function userMessage(): string
    {
        return $this->expectedEmail === null
            ? "Gunakan akun Google kantor (@{$this->domain})."
            : "Gunakan akun Google Anda sendiri ({$this->expectedEmail}).";
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
