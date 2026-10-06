<?php

namespace App\Domain\Hiring\Services;

/**
 * HMAC-SHA256 of the raw request body with the position's webhook secret,
 * hex encoded, sent by the Apps Script in `X-RuangKerja-Signature`
 * (optionally prefixed with `sha256=`).
 */
final class WebhookSignature
{
    public const string HEADER = 'X-RuangKerja-Signature';

    public static function sign(string $body, string $secret): string
    {
        return hash_hmac('sha256', $body, $secret);
    }

    public static function verify(string $body, string $secret, ?string $header): bool
    {
        if ($header === null || $secret === '') {
            return false;
        }

        $given = strtolower(trim($header));

        if (str_starts_with($given, 'sha256=')) {
            $given = substr($given, 7);
        }

        return preg_match('/^[0-9a-f]{64}$/', $given) === 1
            && hash_equals(self::sign($body, $secret), $given);
    }
}
