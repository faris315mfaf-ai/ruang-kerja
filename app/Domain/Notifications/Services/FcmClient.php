<?php

namespace App\Domain\Notifications\Services;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Minimal Firebase Cloud Messaging HTTP v1 client (Http facade, so tests use
 * Http::fake): OAuth2 access token from the service-account JSON
 * (config services.fcm.service_account_json, a file path) cached until shortly
 * before it expires, one message per device token.
 *
 * Never throws for delivery problems: a result tells the caller whether the
 * token is dead (remove it) or the push merely failed (logged, ignored), so
 * a push problem can never break a notification.
 */
final class FcmClient
{
    public const string RESULT_SENT = 'sent';

    public const string RESULT_UNREGISTERED = 'unregistered';

    public const string RESULT_FAILED = 'failed';

    private const string SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

    private const string CACHE_KEY = 'fcm.access-token';

    /** @var array{client_email: string, private_key: string, token_uri: string}|null|false false = not loaded yet */
    private array|null|false $credentials = false;

    public function isConfigured(): bool
    {
        return $this->projectId() !== null && $this->credentials() !== null;
    }

    /**
     * @param  array<string, mixed>  $message  FCM v1 message without the "token" key
     * @return self::RESULT_*
     */
    public function send(string $deviceToken, array $message): string
    {
        $projectId = $this->projectId();

        if ($projectId === null || $this->credentials() === null) {
            return self::RESULT_FAILED;
        }

        try {
            for ($attempt = 0; $attempt < 2; $attempt++) {
                $accessToken = $this->accessToken($attempt > 0);

                if ($accessToken === null) {
                    return self::RESULT_FAILED;
                }

                $response = Http::withToken($accessToken)
                    ->acceptJson()
                    ->timeout(10)
                    ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", [
                        'message' => [...$message, 'token' => $deviceToken],
                    ]);

                if ($response->successful()) {
                    return self::RESULT_SENT;
                }

                // Expired/revoked OAuth token: fetch a fresh one and try once more.
                if ($response->status() === 401 && $attempt === 0) {
                    continue;
                }

                if ($this->isUnregistered($response->status(), $response->json())) {
                    return self::RESULT_UNREGISTERED;
                }

                Log::warning('FCM: pengiriman push gagal.', ['status' => $response->status(), 'error' => data_get($response->json(), 'error.status')]);

                return self::RESULT_FAILED;
            }
        } catch (Throwable $e) {
            Log::warning('FCM: pengiriman push gagal.', ['exception' => $e::class, 'message' => $e->getMessage()]);
        }

        return self::RESULT_FAILED;
    }

    /**
     * @param  mixed  $body  decoded error body
     */
    private function isUnregistered(int $status, mixed $body): bool
    {
        if (! is_array($body)) {
            return false;
        }

        foreach ((array) data_get($body, 'error.details', []) as $detail) {
            if (is_array($detail) && ($detail['errorCode'] ?? null) === 'UNREGISTERED') {
                return true;
            }
        }

        return $status === 404 || data_get($body, 'error.status') === 'NOT_FOUND';
    }

    private function accessToken(bool $forceRefresh): ?string
    {
        if ($forceRefresh) {
            Cache::forget(self::CACHE_KEY);
        }

        $cached = Cache::get(self::CACHE_KEY);

        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $credentials = $this->credentials();

        if ($credentials === null) {
            return null;
        }

        $now = time();
        $assertion = JWT::encode([
            'iss' => $credentials['client_email'],
            'scope' => self::SCOPE,
            'aud' => $credentials['token_uri'],
            'iat' => $now,
            'exp' => $now + 3600,
        ], $credentials['private_key'], 'RS256');

        $response = Http::asForm()->acceptJson()->timeout(10)->post($credentials['token_uri'], [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $assertion,
        ]);

        $token = $response->json('access_token');

        if (! $response->successful() || ! is_string($token) || $token === '') {
            Log::warning('FCM: gagal mengambil token akses OAuth.', ['status' => $response->status()]);

            return null;
        }

        $expiresIn = $response->json('expires_in');
        Cache::put(self::CACHE_KEY, $token, max(60, (is_numeric($expiresIn) ? (int) $expiresIn : 3600) - 300));

        return $token;
    }

    private function projectId(): ?string
    {
        $project = config('services.fcm.project_id');

        return is_string($project) && trim($project) !== '' ? trim($project) : null;
    }

    /**
     * @return array{client_email: string, private_key: string, token_uri: string}|null
     */
    private function credentials(): ?array
    {
        if ($this->credentials !== false) {
            return $this->credentials;
        }

        $this->credentials = null;
        $path = config('services.fcm.service_account_json');

        if (! is_string($path) || trim($path) === '' || ! is_file($path) || ! is_readable($path)) {
            return null;
        }

        $json = json_decode((string) file_get_contents($path), true);

        if (! is_array($json) || ! is_string($json['client_email'] ?? null) || ! is_string($json['private_key'] ?? null)) {
            return null;
        }

        return $this->credentials = [
            'client_email' => $json['client_email'],
            'private_key' => $json['private_key'],
            'token_uri' => is_string($json['token_uri'] ?? null) ? $json['token_uri'] : 'https://oauth2.googleapis.com/token',
        ];
    }
}
