<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Exceptions\GoogleAccountNotAllowed;
use App\Models\GoogleAccount;
use App\Models\User;
use Laravel\Socialite\Two\User as GoogleUser;

/**
 * Saves the tokens of a Google OAuth callback in google_accounts (one row
 * per user). Shared with the Google login (Sprint 1): call it from the
 * login callback when the token response includes drive.file.
 */
final class StoreGoogleAccount
{
    /**
     * @throws GoogleAccountNotAllowed when outside GOOGLE_ALLOWED_DOMAIN
     */
    public function handle(User $user, GoogleUser $googleUser): GoogleAccount
    {
        $email = strtolower((string) $googleUser->getEmail());
        $this->ensureAllowedDomain($email, $googleUser);

        $account = GoogleAccount::query()->firstOrNew(['user_id' => $user->id]);

        // Google only returns a refresh token on (re)consent: keep the old one otherwise.
        $refreshToken = $googleUser->refreshToken !== null && $googleUser->refreshToken !== ''
            ? $googleUser->refreshToken
            : ($account->google_id === (string) $googleUser->getId() ? $account->refresh_token : null);

        $scopes = array_values(array_filter(array_map('strval', (array) $googleUser->approvedScopes)));

        $account->forceFill([
            'google_id' => (string) $googleUser->getId(),
            'email' => $email,
            'access_token' => $googleUser->token,
            'refresh_token' => $refreshToken,
            'expires_at' => $googleUser->expiresIn > 0 ? now()->addSeconds($googleUser->expiresIn) : null,
            'scopes' => $scopes,
        ])->save();

        return $account;
    }

    /**
     * Both the e-mail domain and Google's `hd` claim must match (PRD M1).
     */
    private function ensureAllowedDomain(string $email, GoogleUser $googleUser): void
    {
        $domain = strtolower(trim((string) config('google.oauth.allowed_domain', '')));

        if ($domain === '') {
            return;
        }

        $raw = $googleUser->getRaw();
        $hostedDomain = is_string($raw['hd'] ?? null) ? strtolower($raw['hd']) : null;

        if (! str_ends_with($email, '@'.$domain) || $hostedDomain !== $domain) {
            throw new GoogleAccountNotAllowed($domain);
        }
    }
}
