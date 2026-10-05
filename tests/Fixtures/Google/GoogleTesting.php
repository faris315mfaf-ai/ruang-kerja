<?php

namespace Tests\Fixtures\Google;

use App\Domain\Google\Contracts\AccessTokenProvider;
use Illuminate\Support\Facades\Http;

/**
 * Configuration helpers for Google tests.
 */
final class GoogleTesting
{
    public const string SA_TOKEN = 'ya29.service-account-token-secret';

    public const string SHARED_DRIVE = 'shared-drive-123';

    public const string IMPERSONATE = 'drive-admin@demo.test';

    private static ?string $privateKey = null;

    private static ?string $publicKey = null;

    /**
     * No Google configuration at all and no fake.
     */
    public static function disable(): void
    {
        config([
            'google.fake' => false,
            'google.service_account.credentials' => null,
            'google.service_account.impersonate' => null,
            'google.shared_drive_id' => null,
            'google.oauth.client_id' => null,
            'google.oauth.client_secret' => null,
            'google.picker.api_key' => null,
            'google.picker.app_id' => null,
            'google.oauth.allowed_domain' => null,
        ]);
    }

    /**
     * Real HttpDriveClient against Http::fake() with a generated service account key.
     */
    public static function useRealServiceAccount(): void
    {
        self::disable();

        config([
            'google.service_account.credentials' => self::serviceAccountJson(),
            'google.service_account.impersonate' => self::IMPERSONATE,
            'google.shared_drive_id' => self::SHARED_DRIVE,
            'google.retry.jitter' => false,
        ]);
    }

    public static function configureOAuth(): void
    {
        config([
            'google.oauth.client_id' => '123456789012-abc123.apps.googleusercontent.com',
            'google.oauth.client_secret' => 'oauth-client-secret',
            'google.oauth.redirect' => 'http://localhost/google/connect/callback',
            'google.picker.api_key' => 'picker-api-key',
        ]);
    }

    /**
     * Fake response of the OAuth token endpoint for the service account.
     *
     * @return array<string, mixed>
     */
    public static function tokenResponse(): array
    {
        return ['oauth2.googleapis.com/token' => Http::response(['access_token' => self::SA_TOKEN, 'expires_in' => 3599, 'token_type' => 'Bearer'])];
    }

    public static function serviceAccountJson(): string
    {
        return (string) json_encode([
            'type' => 'service_account',
            'client_email' => 'ruangkerja@project.iam.gserviceaccount.com',
            'private_key' => self::privateKey(),
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ]);
    }

    public static function privateKey(): string
    {
        self::generate();

        return (string) self::$privateKey;
    }

    public static function publicKey(): string
    {
        self::generate();

        return (string) self::$publicKey;
    }

    /**
     * Static token provider for HttpDriveClient unit tests.
     */
    public static function tokens(string $token = 'ya29.test-token'): AccessTokenProvider
    {
        return new class($token) implements AccessTokenProvider
        {
            public int $forgotten = 0;

            /** @var list<string> */
            public array $issued = [];

            public function __construct(private string $token) {}

            public function token(): string
            {
                $this->issued[] = $this->token;

                return $this->token;
            }

            public function forget(): void
            {
                $this->forgotten++;
                $this->token .= '-renewed';
            }
        };
    }

    private static function generate(): void
    {
        if (self::$privateKey !== null) {
            return;
        }

        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $private);

        self::$privateKey = $private;
        self::$publicKey = openssl_pkey_get_details($key)['key'];
    }
}
