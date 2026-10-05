<?php

namespace App\Domain\Google\Auth;

use App\Domain\Google\Contracts\AccessTokenProvider;
use App\Domain\Google\Services\GoogleUserTokens;
use App\Models\GoogleAccount;

/**
 * Access token of one user's connected Google account.
 */
final class UserAccessTokenProvider implements AccessTokenProvider
{
    public function __construct(
        private readonly GoogleAccount $account,
        private readonly GoogleUserTokens $tokens,
    ) {}

    public function token(): string
    {
        return $this->tokens->accessToken($this->account);
    }

    public function forget(): void
    {
        $this->tokens->expire($this->account);
    }
}
