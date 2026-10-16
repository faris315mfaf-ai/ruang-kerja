<?php

namespace App\Domain\Auth\Services;

use Carbon\CarbonImmutable;

/**
 * The request token the app keeps for "Lupa kata sandi". The web keeps the
 * request time in the session; the API has no session, so the time travels in
 * the token itself: `<random>.<unix time>.<HMAC>`. The HMAC (app key) makes
 * the time tamper-proof — a client could otherwise claim an old time and,
 * through the `pending` → `expired` switch of unknown addresses, tell real
 * accounts from fake ones. Only `<random>` is hashed into the database.
 */
final class ApiPasswordResetToken
{
    public static function wrap(string $token, CarbonImmutable $requestedAt): string
    {
        $time = (string) $requestedAt->getTimestamp();

        return $token.'.'.$time.'.'.self::signature($token, $time);
    }

    /**
     * @return array{token: string, requestedAt: CarbonImmutable}|null null when malformed or forged
     */
    public static function unwrap(string $wrapped): ?array
    {
        $parts = explode('.', $wrapped);

        if (count($parts) !== 3 || $parts[0] === '' || ! ctype_digit($parts[1])) {
            return null;
        }

        [$token, $time, $signature] = $parts;

        if (! hash_equals(self::signature($token, $time), $signature)) {
            return null;
        }

        return ['token' => $token, 'requestedAt' => CarbonImmutable::createFromTimestamp((int) $time)];
    }

    private static function signature(string $token, string $time): string
    {
        return hash_hmac('sha256', $token.'|'.$time, config()->string('app.key'));
    }
}
