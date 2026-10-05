<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Jobs\RevokeGoogleToken;
use App\Models\GoogleAccount;

/**
 * Removes the user's Google connection and revokes the grant at Google
 * (queued). Files already attached stay; the Picker needs a reconnect.
 */
final class DisconnectGoogleAccount
{
    public function handle(GoogleAccount $account): void
    {
        $token = $account->refresh_token ?? $account->access_token;

        $account->delete();

        if ($token !== '') {
            // Only once the deletion is committed (callers may run inside a transaction).
            RevokeGoogleToken::dispatch($token)->afterCommit();
        }
    }
}
