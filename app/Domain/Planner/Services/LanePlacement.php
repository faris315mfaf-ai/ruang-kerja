<?php

namespace App\Domain\Planner\Services;

use App\Domain\Planner\Enums\PlanBucket;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Automatic lane of a task without a plan (nothing is written): overdue or
 * due today → "Hari ini", due by Sunday of the current ISO week → "Minggu
 * ini", later or undated → "Nanti".
 */
final class LanePlacement
{
    public static function auto(?CarbonInterface $due, CarbonImmutable $today): PlanBucket
    {
        if ($due === null) {
            return PlanBucket::Later;
        }

        $date = $due->toDateString();

        return match (true) {
            $date <= $today->toDateString() => PlanBucket::Today,
            $date <= self::weekEnd($today)->toDateString() => PlanBucket::Week,
            default => PlanBucket::Later,
        };
    }

    /**
     * Sunday of the ISO week containing $today.
     */
    public static function weekEnd(CarbonImmutable $today): CarbonImmutable
    {
        return $today->endOfWeek(CarbonImmutable::SUNDAY)->startOfDay();
    }
}
