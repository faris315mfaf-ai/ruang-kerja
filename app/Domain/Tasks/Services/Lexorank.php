<?php

namespace App\Domain\Tasks\Services;

use InvalidArgumentException;

/**
 * Lexicographic rank keys (fractional indexing) for stable Kanban ordering.
 *
 * Keys use base-62 digits in ASCII order (0-9 < A-Z < a-z), so they sort the
 * same way with strcmp() and with a PostgreSQL column using COLLATE "C".
 * A valid key is non-empty and never ends with the smallest digit "0", which
 * guarantees there is always room between two keys.
 *
 * Appending and prepending step one digit at a time, so keys grow by roughly
 * one character every ~30 operations; repeated inserts between the same two
 * neighbours grow by one character every ~6. Callers rebalance a column with
 * sequence() when a key exceeds MAX_LENGTH.
 */
final class Lexorank
{
    public const string DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    /** Rebalance threshold; the database column allows 100 characters. */
    public const int MAX_LENGTH = 40;

    private const int BASE = 62;

    /**
     * Key strictly between $before and $after; null means "open end".
     *
     * @throws InvalidArgumentException when a key is invalid or $before >= $after
     */
    public static function between(?string $before, ?string $after): string
    {
        if ($before !== null) {
            self::assertValid($before);
        }

        if ($after !== null) {
            self::assertValid($after);
        }

        if ($before !== null && $after !== null && strcmp($before, $after) >= 0) {
            throw new InvalidArgumentException("Rank [{$before}] must sort before [{$after}].");
        }

        return match (true) {
            $before === null && $after === null => self::DIGITS[intdiv(self::BASE, 2)],
            $after === null => self::after((string) $before),
            $before === null => self::before($after),
            default => self::midpoint($before, $after),
        };
    }

    /**
     * $count evenly spaced keys in ascending order (for seeding or rebalancing).
     *
     * @return list<string>
     */
    public static function sequence(int $count): array
    {
        if ($count < 1) {
            return [];
        }

        $length = 1;

        while (self::BASE ** $length <= $count + 1) {
            $length++;
        }

        $space = self::BASE ** $length;
        $keys = [];

        for ($i = 1; $i <= $count; $i++) {
            $value = intdiv($i * $space, $count + 1);
            $keys[] = rtrim(self::encode($value, $length), '0');
        }

        return $keys;
    }

    public static function isValid(string $key): bool
    {
        return $key !== ''
            && strspn($key, self::DIGITS) === strlen($key)
            && ! str_ends_with($key, '0');
    }

    public static function assertValid(string $key): void
    {
        if (! self::isValid($key)) {
            throw new InvalidArgumentException("Invalid rank key [{$key}].");
        }
    }

    /**
     * Smallest change that sorts after $key: bump the first digit below "z".
     */
    private static function after(string $key): string
    {
        $length = strlen($key);

        for ($i = 0; $i < $length; $i++) {
            $digit = self::digit($key[$i]);

            if ($digit < self::BASE - 1) {
                return substr($key, 0, $i).self::DIGITS[$digit + 1];
            }
        }

        return $key.self::DIGITS[intdiv(self::BASE, 2)];
    }

    /**
     * Smallest change that sorts before $key: lower the first digit above "1".
     */
    private static function before(string $key): string
    {
        $length = strlen($key);

        for ($i = 0; $i < $length; $i++) {
            $digit = self::digit($key[$i]);

            if ($digit > 1) {
                return substr($key, 0, $i).self::DIGITS[$digit - 1];
            }
        }

        return self::midpoint('', $key);
    }

    /**
     * Midpoint between $a (may be "") and $b (null = +infinity), after
     * Evan Wallace's fractional indexing algorithm.
     */
    private static function midpoint(string $a, ?string $b): string
    {
        if ($b !== null) {
            // Skip the common prefix, padding $a with the zero digit.
            $n = 0;
            $bLength = strlen($b);

            while ($n < $bLength && ($a[$n] ?? '0') === $b[$n]) {
                $n++;
            }

            if ($n > 0) {
                return substr($b, 0, $n).self::midpoint(substr($a, $n), substr($b, $n));
            }
        }

        $digitA = $a !== '' ? self::digit($a[0]) : 0;
        $digitB = $b !== null ? self::digit($b[0]) : self::BASE;

        if ($digitB - $digitA > 1) {
            return self::DIGITS[intdiv($digitA + $digitB + 1, 2)];
        }

        // The first digits are consecutive.
        if ($b !== null && strlen($b) > 1) {
            return $b[0];
        }

        return self::DIGITS[$digitA].self::midpoint(substr($a, 1), null);
    }

    private static function digit(string $char): int
    {
        $position = strpos(self::DIGITS, $char);

        if ($position === false) {
            throw new InvalidArgumentException("Invalid rank digit [{$char}].");
        }

        return $position;
    }

    private static function encode(int $value, int $length): string
    {
        $out = '';

        for ($i = 0; $i < $length; $i++) {
            $out = self::DIGITS[$value % self::BASE].$out;
            $value = intdiv($value, self::BASE);
        }

        return $out;
    }
}
