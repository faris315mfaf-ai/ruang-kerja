<?php

namespace App\Domain\Google\Services;

/**
 * Exponential backoff for Google calls: base * 2^(attempt-1), at least the
 * server's Retry-After, capped at max_delay, plus optional jitter.
 */
final class GoogleBackoff
{
    public static function delay(int $attempt, ?int $retryAfter = null): int
    {
        $base = max(1, (int) config('google.retry.base_delay', 10));
        $max = max($base, (int) config('google.retry.max_delay', 900));

        $delay = min($max, $base * (2 ** max(0, min($attempt - 1, 20))));
        $delay = max($delay, min($max, max(0, $retryAfter ?? 0)));

        if ((bool) config('google.retry.jitter', true)) {
            $delay = min($max, $delay + random_int(0, $base));
        }

        return $delay;
    }

    /**
     * Delays (seconds) for the queue worker's `backoff` between attempts.
     *
     * @return list<int>
     */
    public static function schedule(int $tries): array
    {
        $base = max(1, (int) config('google.retry.base_delay', 10));
        $max = max($base, (int) config('google.retry.max_delay', 900));

        return array_map(
            static fn (int $attempt): int => min($max, $base * (2 ** ($attempt - 1))),
            range(1, max(1, $tries - 1)),
        );
    }
}
