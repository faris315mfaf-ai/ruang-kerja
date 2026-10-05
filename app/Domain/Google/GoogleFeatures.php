<?php

namespace App\Domain\Google;

use App\Domain\Google\Exceptions\GoogleNotConfigured;

/**
 * Feature flags for the Google integration, read from config/google.php.
 *
 * - Drive (folders, permissions, documents, uploads) needs the service
 *   account, the impersonated admin and the Shared Drive id.
 * - Per-user OAuth (connect + Picker) needs the OAuth client; Picker also
 *   needs the API key.
 * - `google.fake` (never honoured in production) swaps Google for
 *   FakeDriveClient and counts as "Drive enabled".
 */
final class GoogleFeatures
{
    public const string DISABLED_MESSAGE = 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.';

    public const string ADMIN_HINT = 'Isi GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_IMPERSONATE_USER dan GOOGLE_SHARED_DRIVE_ID, lalu jalankan php artisan ruangkerja:google-check.';

    public static function fake(): bool
    {
        return (bool) config('google.fake') && ! app()->isProduction();
    }

    /**
     * Drive features available (service account configured, or fake mode).
     */
    public static function enabled(): bool
    {
        return self::fake() || self::missingDriveSettings() === [];
    }

    /**
     * Per-user OAuth (connect Google account) is configured.
     */
    public static function oauthEnabled(): bool
    {
        return self::missingOAuthSettings() === [];
    }

    /**
     * Google Picker can be opened: OAuth client + API key + project number.
     * Never in fake mode (the Picker is Google-hosted UI).
     */
    public static function pickerEnabled(): bool
    {
        return ! self::fake()
            && self::oauthEnabled()
            && self::filled(config('google.picker.api_key'))
            && self::pickerAppId() !== null;
    }

    /**
     * @throws GoogleNotConfigured
     */
    public static function ensureEnabled(): void
    {
        if (! self::enabled()) {
            throw new GoogleNotConfigured(self::missingDriveSettings());
        }
    }

    /**
     * @throws GoogleNotConfigured
     */
    public static function ensureOAuthEnabled(): void
    {
        if (! self::oauthEnabled()) {
            throw new GoogleNotConfigured(self::missingOAuthSettings(), 'Google OAuth');
        }
    }

    /**
     * Env keys (never values) that are missing for Drive features.
     *
     * @return list<string>
     */
    public static function missingDriveSettings(): array
    {
        $missing = [];

        $credentials = config('google.service_account.credentials');

        if (! self::filled($credentials) || ! self::credentialsAvailable((string) $credentials)) {
            $missing[] = 'GOOGLE_SERVICE_ACCOUNT_JSON';
        }

        if (! self::filled(config('google.service_account.impersonate'))) {
            $missing[] = 'GOOGLE_IMPERSONATE_USER';
        }

        if (! self::filled(config('google.shared_drive_id'))) {
            $missing[] = 'GOOGLE_SHARED_DRIVE_ID';
        }

        return $missing;
    }

    /**
     * @return list<string>
     */
    public static function missingOAuthSettings(): array
    {
        $missing = [];

        if (! self::filled(config('google.oauth.client_id'))) {
            $missing[] = 'GOOGLE_CLIENT_ID';
        }

        if (! self::filled(config('google.oauth.client_secret'))) {
            $missing[] = 'GOOGLE_CLIENT_SECRET';
        }

        return $missing;
    }

    /**
     * Cloud project number for the Picker `setAppId()`: explicit config or the
     * numeric prefix of the OAuth client id ("1234567890-abc.apps.googleusercontent.com").
     */
    public static function pickerAppId(): ?string
    {
        $explicit = config('google.picker.app_id');

        if (self::filled($explicit)) {
            return (string) $explicit;
        }

        $clientId = (string) config('google.oauth.client_id', '');

        return preg_match('/^(\d+)-/', $clientId, $matches) === 1 ? $matches[1] : null;
    }

    public static function maxUploadBytes(): int
    {
        return (int) config('google.upload.max_bytes', 100 * 1024 * 1024);
    }

    /**
     * Inline JSON or a readable file path.
     */
    private static function credentialsAvailable(string $credentials): bool
    {
        return str_starts_with(ltrim($credentials), '{') || is_readable($credentials);
    }

    private static function filled(mixed $value): bool
    {
        return is_string($value) ? trim($value) !== '' : $value !== null;
    }
}
