<?php

namespace App\Domain\Google\Auth;

use App\Domain\Google\Contracts\AccessTokenProvider;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;

/**
 * OAuth 2.0 JWT-bearer flow for a service account with domain-wide
 * delegation: signs an RS256 assertion whose `sub` is the impersonated
 * Workspace user and exchanges it for an access token. Tokens are cached
 * (encrypted) until five minutes before expiry.
 */
final class ServiceAccountTokenProvider implements AccessTokenProvider
{
    private const string OPERATION = 'auth.service_account';

    /**
     * @param  list<string>  $scopes
     */
    public function __construct(
        private readonly ServiceAccountCredentials $credentials,
        private readonly string $subject,
        private readonly array $scopes,
        private readonly Cache $cache,
        private readonly int $timeout = 10,
    ) {}

    /**
     * @throws DriveRequestFailed|GoogleNotConfigured
     */
    public function token(): string
    {
        $cached = $this->cache->get($this->cacheKey());

        if (is_string($cached)) {
            try {
                return Crypt::decryptString($cached);
            } catch (DecryptException) {
                $this->forget();
            }
        }

        try {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout($this->timeout)
                ->post($this->credentials->tokenUri, [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $this->assertion(),
                ]);
        } catch (ConnectionException $exception) {
            throw DriveRequestFailed::fromConnection(self::OPERATION, $exception);
        }

        $token = $response->json('access_token');

        if ($response->failed() || ! is_string($token) || $token === '') {
            throw DriveRequestFailed::fromResponse(self::OPERATION, $response);
        }

        $expiresIn = $response->json('expires_in');
        $ttl = max(60, (is_numeric($expiresIn) ? (int) $expiresIn : 3600) - 300);

        $this->cache->put($this->cacheKey(), Crypt::encryptString($token), $ttl);

        return $token;
    }

    public function forget(): void
    {
        $this->cache->forget($this->cacheKey());
    }

    /**
     * Signed JWT assertion (RFC 7523) for the token endpoint.
     *
     * @throws GoogleNotConfigured
     */
    public function assertion(): string
    {
        $now = now()->getTimestamp();

        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $claims = [
            'iss' => $this->credentials->clientEmail,
            'sub' => $this->subject,
            'scope' => implode(' ', $this->scopes),
            'aud' => $this->credentials->tokenUri,
            'iat' => $now,
            'exp' => $now + 3600,
        ];

        $input = self::base64Url((string) json_encode($header)).'.'.self::base64Url((string) json_encode($claims));

        if (! openssl_sign($input, $signature, $this->credentials->signingKey(), OPENSSL_ALGO_SHA256)) {
            throw new GoogleNotConfigured(['GOOGLE_SERVICE_ACCOUNT_JSON']);
        }

        return $input.'.'.self::base64Url($signature);
    }

    private function cacheKey(): string
    {
        return 'google:sa-token:'.sha1($this->credentials->clientEmail.'|'.$this->subject.'|'.implode(' ', $this->scopes));
    }

    private static function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
