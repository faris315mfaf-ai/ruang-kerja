<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Exceptions\GoogleAccountNotAllowed;
use App\Models\Company;
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
     * @throws GoogleAccountNotAllowed when outside GOOGLE_ALLOWED_DOMAIN or not the user's own account
     */
    public function handle(User $user, GoogleUser $googleUser): GoogleAccount
    {
        $email = strtolower((string) $googleUser->getEmail());
        $domain = $this->ensureAllowedDomain($user, $email, $googleUser);
        $this->ensureOwnAccount($user, $email, (string) $googleUser->getId(), $domain);

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
     * Both the e-mail domain and Google's `hd` claim must match the company's
     * Workspace domain (PRD M1). GOOGLE_ALLOWED_DOMAIN overrides
     * companies.google_domain when set.
     */
    private function ensureAllowedDomain(User $user, string $email, GoogleUser $googleUser): string
    {
        $domain = strtolower(trim((string) config('google.oauth.allowed_domain', '')));

        if ($domain === '') {
            // Fresh lookup: the in-memory relation may hold partial columns.
            $domain = strtolower((string) Company::query()->whereKey($user->company_id)->value('google_domain'));
        }

        $raw = $googleUser->getRaw();
        $hostedDomain = is_string($raw['hd'] ?? null) ? strtolower($raw['hd']) : null;

        if (! str_ends_with($email, '@'.$domain) || $hostedDomain !== $domain) {
            throw new GoogleAccountNotAllowed($domain);
        }

        return $domain;
    }

    /**
     * Drive files are created as the employee: the account must be their own
     * Workspace identity — same address (case-insensitive) or the Google id
     * linked at sign-in (the address may have been renamed at Google).
     */
    private function ensureOwnAccount(User $user, string $email, string $googleId, string $domain): void
    {
        $sameEmail = $email === strtolower($user->email);
        $sameIdentity = $user->google_id !== null && $user->google_id === $googleId;

        if (! $sameEmail && ! $sameIdentity) {
            throw GoogleAccountNotAllowed::notOwnAccount($domain, $user->email);
        }
    }
}
