<?php

namespace App\Domain\Analytics\Okr;

/**
 * Progres key result (docs/fitur/okr.md): (kini − awal) ÷ (target − awal).
 * Works for "lower is better" targets (bugs 14 → 4); the raw value goes below
 * 0 when the value moved away from the target and above 1 past the target.
 * Mirrors krRawProgress / krProgress in resources/js/features/okr/lib.ts.
 */
final class KeyResultProgress
{
    public static function raw(float $start, float $target, float $current): float
    {
        $span = $target - $start;

        if (abs($span) < 1e-9) {
            return abs($current - $target) < 1e-9 ? 1.0 : 0.0;
        }

        return ($current - $start) / $span;
    }

    /**
     * Progress for display, 0–1.
     */
    public static function display(float $start, float $target, float $current): float
    {
        return self::clamp(self::raw($start, $target, $current), 0.0, 1.0);
    }

    /**
     * Progress used for the status: clamped to −1…1 so a key result that moved
     * backwards pulls the status down without dominating the average.
     */
    public static function forStatus(float $start, float $target, float $current): float
    {
        return self::clamp(self::raw($start, $target, $current), -1.0, 1.0);
    }

    public static function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, $value));
    }
}
