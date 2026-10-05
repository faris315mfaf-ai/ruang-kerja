<?php

namespace App\Domain\Analytics\Projects;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Progres rencana (PRD M10): (today − start) ÷ (target − start), limited to
 * 0–100%. Dates are office-calendar dates. A target on or before the start
 * counts as 0% until the target and 100% from then on. Missing dates → null.
 */
final class PlannedProgress
{
    public static function calculate(?CarbonInterface $start, ?CarbonInterface $target, CarbonInterface $today): ?float
    {
        if ($start === null || $target === null) {
            return null;
        }

        $start = self::day($start);
        $target = self::day($target);
        $today = self::day($today);

        $duration = $start->diffInDays($target, false);

        if ($duration <= 0) {
            return $today->greaterThanOrEqualTo($target) ? 100.0 : 0.0;
        }

        return ActualProgress::clamp($start->diffInDays($today, false) / $duration * 100);
    }

    private static function day(CarbonInterface $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date->format('Y-m-d'), 'UTC');
    }
}
