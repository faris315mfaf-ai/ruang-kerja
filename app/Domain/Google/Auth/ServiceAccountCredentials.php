<?php

namespace App\Domain\Google\Auth;

use App\Domain\Google\Exceptions\GoogleNotConfigured;
use OpenSSLAsymmetricKey;

/**
 * Parsed service account key (GOOGLE_SERVICE_ACCOUNT_JSON: a file path or
 * the JSON itself). The private key never leaves this object.
 */
final class ServiceAccountCredentials
{
    public const string TOKEN_HOST = 'oauth2.googleapis.com';

    private function __construct(
        public readonly string $clientEmail,
        private readonly string $privateKey,
        public readonly string $tokenUri,
    ) {}

    /**
     * @throws GoogleNotConfigured
     */
    public static function fromConfig(): self
    {
        $value = config('google.service_account.credentials');

        if (! is_string($value) || trim($value) === '') {
            throw new GoogleNotConfigured(['GOOGLE_SERVICE_ACCOUNT_JSON']);
        }

        return self::fromString($value);
    }

    /**
     * @throws GoogleNotConfigured
     */
    public static function fromString(string $value): self
    {
        $json = str_starts_with(ltrim($value), '{')
            ? $value
            : (is_readable($value) ? (string) file_get_contents($value) : '');

        $data = json_decode($json, true);

        if (! is_array($data)
            || ! is_string($data['client_email'] ?? null)
            || ! is_string($data['private_key'] ?? null)) {
            throw new GoogleNotConfigured(['GOOGLE_SERVICE_ACCOUNT_JSON']);
        }

        $tokenUri = is_string($data['token_uri'] ?? null)
            ? $data['token_uri']
            : (string) config('google.service_account.token_uri');

        // The signed assertion (a bearer credential for the whole Shared Drive)
        // is only ever sent to Google's token endpoint over HTTPS.
        if (! self::isGoogleTokenUri($tokenUri)) {
            throw new GoogleNotConfigured(['GOOGLE_SERVICE_ACCOUNT_JSON']);
        }

        return new self($data['client_email'], $data['private_key'], $tokenUri);
    }

    public static function isGoogleTokenUri(string $uri): bool
    {
        $parts = parse_url($uri);

        return is_array($parts)
            && ($parts['scheme'] ?? null) === 'https'
            && strtolower($parts['host'] ?? '') === self::TOKEN_HOST
            && ! isset($parts['user'])
            && ! isset($parts['pass'])
            && ! isset($parts['port']);
    }

    /**
     * @throws GoogleNotConfigured when the PEM key cannot be read
     */
    public function signingKey(): OpenSSLAsymmetricKey
    {
        $key = openssl_pkey_get_private($this->privateKey);

        if ($key === false) {
            throw new GoogleNotConfigured(['GOOGLE_SERVICE_ACCOUNT_JSON']);
        }

        return $key;
    }

    /**
     * @return array<string, string>
     */
    public function __debugInfo(): array
    {
        return ['clientEmail' => $this->clientEmail, 'tokenUri' => $this->tokenUri];
    }
}
