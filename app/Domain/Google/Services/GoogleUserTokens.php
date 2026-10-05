<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConnected;
use App\Domain\Google\Exceptions\GoogleReconnectRequired;
use App\Domain\Google\GoogleFeatures;
use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Per-user OAuth tokens (google_accounts): returns a fresh access token,
 * refreshing it with the stored refresh token when it is about to expire.
 * A revoked/expired grant (invalid_grant) clears the refresh token so the UI
 * asks the user to reconnect.
 */
final class GoogleUserTokens
{
    private const string OPERATION = 'auth.user_refresh';

    /**
     * @throws GoogleNotConnected when there is no account with Drive access
     * @throws GoogleReconnectRequired
     */
    public function accountFor(User $user): GoogleAccount
    {
        $account = GoogleAccount::query()->where('user_id', $user->id)->first();

        if ($account === null || ! $account->hasDriveAccess()) {
            throw new GoogleNotConnected;
        }

        if ($account->needsReconnect()) {
            throw new GoogleReconnectRequired;
        }

        return $account;
    }

    /**
     * @throws GoogleReconnectRequired|DriveRequestFailed
     */
    public function accessToken(GoogleAccount $account): string
    {
        if (! $account->tokenExpired()) {
            return $account->access_token;
        }

        return Cache::lock('google:user-token:'.$account->id, 20)->block(10, function () use ($account): string {
            // Another request may have refreshed while we waited for the lock.
            $account->refresh();

            return $account->tokenExpired() ? $this->refresh($account)->access_token : $account->access_token;
        });
    }

    /**
     * @throws GoogleReconnectRequired|DriveRequestFailed
     */
    public function refresh(GoogleAccount $account): GoogleAccount
    {
        GoogleFeatures::ensureOAuthEnabled();

        if ($account->refresh_token === null) {
            throw new GoogleReconnectRequired;
        }

        try {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout((int) config('google.http.sync_timeout', 10))
                ->post((string) config('google.oauth.token_uri'), [
                    'client_id' => config('google.oauth.client_id'),
                    'client_secret' => config('google.oauth.client_secret'),
                    'refresh_token' => $account->refresh_token,
                    'grant_type' => 'refresh_token',
                ]);
        } catch (ConnectionException $exception) {
            throw DriveRequestFailed::fromConnection(self::OPERATION, $exception);
        }

        if ($response->status() === 400 && $response->json('error') === 'invalid_grant') {
            $account->forceFill(['refresh_token' => null, 'expires_at' => now()])->save();

            throw new GoogleReconnectRequired;
        }

        $token = $response->json('access_token');

        if ($response->failed() || ! is_string($token) || $token === '') {
            throw DriveRequestFailed::fromResponse(self::OPERATION, $response);
        }

        $expiresIn = $response->json('expires_in');
        $scope = $response->json('scope');
        $refreshToken = $response->json('refresh_token');

        $account->forceFill([
            'access_token' => $token,
            'expires_at' => now()->addSeconds(is_numeric($expiresIn) ? (int) $expiresIn : 3600),
            'scopes' => is_string($scope) && $scope !== '' ? explode(' ', $scope) : $account->scopes,
            'refresh_token' => is_string($refreshToken) && $refreshToken !== '' ? $refreshToken : $account->refresh_token,
        ])->save();

        return $account;
    }

    /**
     * Marks the access token expired so the next call refreshes it.
     */
    public function expire(GoogleAccount $account): void
    {
        $account->forceFill(['expires_at' => now()->subSecond()])->save();
    }
}
