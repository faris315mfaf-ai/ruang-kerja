<?php

namespace App\Domain\Google\Exceptions;

/**
 * The Google integration (or the part being used) has no configuration.
 */
final class GoogleNotConfigured extends GoogleException
{
    /**
     * @param  list<string>  $missing  Names of the missing env keys (never values).
     */
    public function __construct(public readonly array $missing = [], string $feature = 'Google Drive')
    {
        parent::__construct($feature.' is not configured'.($missing === [] ? '' : ' (missing: '.implode(', ', $missing).')'));
    }

    public function userMessage(): string
    {
        return 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.';
    }

    public function errorCode(): string
    {
        return 'google_not_configured';
    }

    public function httpStatus(): int
    {
        return 503;
    }
}
