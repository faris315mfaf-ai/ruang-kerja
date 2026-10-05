<?php

namespace App\Domain\Attendance\Support;

/**
 * Short, human-typable kiosk pairing code ("ABCD-2345"), an alternative to the
 * activation link for devices where opening a long URL is awkward (TV, kiosk
 * browser). 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L),
 * ≈ 31^8 ≈ 8.5 × 10^11 combinations; guessing is further limited by the
 * per-IP attempt limit and lockout in KioskActivationController.
 */
final class KioskActivationCode
{
    public const string ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    public const int LENGTH = 8;

    /**
     * A new random code, grouped for reading out ("ABCD-2345").
     */
    public static function generate(): string
    {
        $last = strlen(self::ALPHABET) - 1;
        $code = '';

        for ($i = 0; $i < self::LENGTH; $i++) {
            $code .= self::ALPHABET[random_int(0, $last)];
        }

        return self::format($code);
    }

    /**
     * Canonical form of user input (upper case, separators and spaces
     * removed), or null when it cannot be a code at all.
     */
    public static function normalize(string $input): ?string
    {
        $code = strtoupper((string) preg_replace('/[\s\-_.]+/', '', $input));

        if (strlen($code) !== self::LENGTH || strspn($code, self::ALPHABET) !== self::LENGTH) {
            return null;
        }

        return $code;
    }

    public static function format(string $code): string
    {
        return substr($code, 0, 4).'-'.substr($code, 4);
    }

    /**
     * Keyed hash of a normalized code. Keyed (unlike the long link token's plain
     * SHA-256) because the code space is small enough to brute-force
     * from a leaked database without the key.
     */
    public static function hash(string $normalized): string
    {
        return hash_hmac('sha256', 'kiosk-activation-code|'.$normalized, config()->string('app.key'));
    }
}
