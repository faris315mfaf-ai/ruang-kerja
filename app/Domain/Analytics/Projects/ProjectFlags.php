<?php

namespace App\Domain\Analytics\Projects;

use App\Domain\Projects\Enums\ProjectFlag;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Penanda sistem (PRD M10), shown next to the health set by the PIC:
 * - Behind: actual − planned ≤ −15 percentage points (variance rounded to 0.1);
 * - MissedMilestone: a milestone is past its target and not completed;
 * - StaleUpdate: the last update is more than 7 office days old, or there is
 *   none while the project has been tracked for more than 7 days.
 */
final class ProjectFlags
{
    public const float BEHIND_THRESHOLD = -15.0;

    public const int STALE_AFTER_DAYS = 7;

    public static function variance(?float $actual, ?float $planned): ?float
    {
        if ($actual === null || $planned === null) {
            return null;
        }

        return round($actual - $planned, 1);
    }

    /**
     * Whole office days between the last update and today (null: never updated).
     */
    public static function updateAgeDays(?CarbonInterface $lastUpdateAt, CarbonInterface $today, string $timezone): ?int
    {
        if ($lastUpdateAt === null) {
            return null;
        }

        $updated = CarbonImmutable::parse($lastUpdateAt->copy()->setTimezone($timezone)->format('Y-m-d'), 'UTC');
        $day = CarbonImmutable::parse($today->format('Y-m-d'), 'UTC');

        return (int) $updated->diffInDays($day, false);
    }

    /**
     * @return list<ProjectFlag>
     */
    public static function evaluate(
        ?float $actual,
        ?float $planned,
        int $missedMilestones,
        ?int $updateAgeDays,
        ?int $trackedDays,
    ): array {
        $flags = [];
        $variance = self::variance($actual, $planned);

        if ($variance !== null && $variance <= self::BEHIND_THRESHOLD) {
            $flags[] = ProjectFlag::Behind;
        }

        if ($missedMilestones > 0) {
            $flags[] = ProjectFlag::MissedMilestone;
        }

        $stale = $updateAgeDays !== null
            ? $updateAgeDays > self::STALE_AFTER_DAYS
            : ($trackedDays !== null && $trackedDays > self::STALE_AFTER_DAYS);

        if ($stale) {
            $flags[] = ProjectFlag::StaleUpdate;
        }

        return $flags;
    }
}
