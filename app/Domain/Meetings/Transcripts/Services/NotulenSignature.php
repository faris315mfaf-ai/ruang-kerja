<?php

namespace App\Domain\Meetings\Transcripts\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * HMAC between the app and the transcriber worker (both directions, same
 * scheme as transcriber/notulen/signing.py):
 *
 *   X-Notulen-Timestamp: <unix seconds>
 *   X-Notulen-Signature: v1=<hex HMAC-SHA256(TRANSCRIBER_SECRET, "<timestamp>.<raw body>")>
 *
 * Outgoing requests are signed with TRANSCRIBER_SECRET, incoming callbacks
 * verified with TRANSCRIBER_CALLBACK_SECRET (one key per direction).
 * The body names the room and the action, so URL paths behind proxies do
 * not matter. Requests outside the tolerance window or with a signature seen
 * before (cache, twice the window) are refused.
 */
final class NotulenSignature
{
    public const string TIMESTAMP_HEADER = 'X-Notulen-Timestamp';

    public const string SIGNATURE_HEADER = 'X-Notulen-Signature';

    /** Signs app → worker requests. */
    public function secret(): string
    {
        return (string) config('notulen.transcriber.secret');
    }

    /** Verifies worker → app callbacks (a different key per direction). */
    public function callbackSecret(): string
    {
        return (string) config('notulen.transcriber.callback_secret');
    }

    public static function compute(string $secret, int $timestamp, string $body): string
    {
        return hash_hmac('sha256', $timestamp.'.'.$body, $secret);
    }

    /**
     * @return array<string, string>
     */
    public function headers(string $body, ?CarbonImmutable $now = null): array
    {
        $timestamp = ($now ?? CarbonImmutable::now())->getTimestamp();

        return [
            self::TIMESTAMP_HEADER => (string) $timestamp,
            self::SIGNATURE_HEADER => 'v1='.self::compute($this->secret(), $timestamp, $body),
        ];
    }

    /**
     * Null when valid, otherwise the reason ("missing", "stale", "invalid", "replayed").
     */
    public function verify(string $body, ?string $timestamp, ?string $signature): ?string
    {
        $secret = $this->callbackSecret();

        if ($secret === '' || $timestamp === null || $signature === null || $timestamp === '' || $signature === '') {
            return 'missing';
        }

        if (preg_match('/^\d{1,12}$/', $timestamp) !== 1 || ! str_starts_with($signature, 'v1=')) {
            return 'invalid';
        }

        $tolerance = max(30, (int) config('notulen.transcriber.tolerance', 300));

        if (abs(CarbonImmutable::now()->getTimestamp() - (int) $timestamp) > $tolerance) {
            return 'stale';
        }

        $given = substr($signature, 3);

        if (! hash_equals(self::compute($secret, (int) $timestamp, $body), $given)) {
            return 'invalid';
        }

        if (! Cache::add('notulen:signature:'.hash('sha256', $given), true, $tolerance * 2)) {
            return 'replayed';
        }

        return null;
    }
}
