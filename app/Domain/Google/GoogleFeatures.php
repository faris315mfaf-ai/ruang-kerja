<?php

namespace App\Domain\Google;

use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Settings\CompanySettings;

/**
 * Feature flags for the Google integration, read from config/google.php.
 *
 * - Drive (folders, permissions, documents, uploads) needs the service
 *   account, the impersonated admin and the Shared Drive id.
 * - Per-user OAuth (connect + Picker) needs the OAuth client; Picker also
 *   needs the API key.
 * - `google.fake` (never honoured in production) swaps Google for
 *   FakeDriveClient and counts as "Drive enabled".
 *
 * Fase 1 multi-perusahaan: the Shared Drive is per company
 * (`companies.settings.google.shared_drive_id`, CompanySettings). Drive
 * checks take the workspace's company (or the current CompanyContext); a
 * company without its own Shared Drive has Drive switched off — except while
 * it is the only company, when GOOGLE_SHARED_DRIVE_ID still applies. Without
 * any company (console, guest) the global configuration is used as before.
 */
final class GoogleFeatures
{
    public const string DISABLED_MESSAGE = 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.';

    public const string ADMIN_HINT = 'Isi GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_IMPERSONATE_USER dan GOOGLE_SHARED_DRIVE_ID, lalu jalankan php artisan ruangkerja:google-check.';

    /** "Missing setting" shown when only the company's own Shared Drive is lacking. */
    public const string COMPANY_SHARED_DRIVE_SETTING = 'Shared Drive perusahaan (php artisan company:configure --shared-drive=…)';

    public static function fake(): bool
    {
        return (bool) config('google.fake') && ! app()->isProduction();
    }

    /**
     * Drive features available for the company (service account configured,
     * or fake mode, and a Shared Drive for that company).
     *
     * @param  string|null  $companyId  workspace's company; null = current CompanyContext
     */
    public static function enabled(?string $companyId = null): bool
    {
        if (self::fake()) {
            return self::sharedDriveMissing($companyId, fake: true) === null;
        }

        return self::serviceAccountMissing() === [] && self::sharedDriveMissing($companyId, fake: false) === null;
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
    public static function ensureEnabled(?string $companyId = null): void
    {
        if (! self::enabled($companyId)) {
            throw new GoogleNotConfigured(self::missingDriveSettings($companyId));
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
     * Env keys (never values) that are missing for Drive features, or
     * COMPANY_SHARED_DRIVE_SETTING when the company lacks its own Shared Drive.
     *
     * @param  string|null  $companyId  workspace's company; null = current CompanyContext
     * @return list<string>
     */
    public static function missingDriveSettings(?string $companyId = null): array
    {
        $missing = self::serviceAccountMissing();
        $drive = self::sharedDriveMissing($companyId, fake: false);

        if ($drive !== null) {
            $missing[] = $drive;
        }

        return $missing;
    }

    /**
     * @return list<string>
     */
    private static function serviceAccountMissing(): array
    {
        $missing = [];

        $credentials = config('google.service_account.credentials');

        if (! self::filled($credentials) || ! self::credentialsAvailable((string) $credentials)) {
            $missing[] = 'GOOGLE_SERVICE_ACCOUNT_JSON';
        }

        if (! self::filled(config('google.service_account.impersonate'))) {
            $missing[] = 'GOOGLE_IMPERSONATE_USER';
        }

        return $missing;
    }

    /**
     * What is missing for the company's Shared Drive, or null when it has one.
     * In fake mode the global id is not needed (the fake provides one).
     */
    private static function sharedDriveMissing(?string $companyId, bool $fake): ?string
    {
        $companyId ??= app(CompanyContext::class)->id();
        $global = $fake || self::filled(config('google.shared_drive_id'));

        if ($companyId === null) {
            return $global ? null : 'GOOGLE_SHARED_DRIVE_ID';
        }

        $settings = CompanySettings::resolve();

        if ($settings->own($companyId, CompanySettings::SHARED_DRIVE_ID) !== null) {
            return null;
        }

        if (! $settings->usesGlobalFallback($companyId)) {
            return self::COMPANY_SHARED_DRIVE_SETTING;
        }

        return $global ? null : 'GOOGLE_SHARED_DRIVE_ID';
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
