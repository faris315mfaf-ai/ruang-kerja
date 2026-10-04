<?php

namespace App\Domain\Google\Contracts;

/**
 * Supplies an OAuth access token for Google API calls.
 */
interface AccessTokenProvider
{
    public function token(): string;

    /**
     * Drop a cached token (e.g. after a 401) so the next token() fetches a new one.
     */
    public function forget(): void;
}
