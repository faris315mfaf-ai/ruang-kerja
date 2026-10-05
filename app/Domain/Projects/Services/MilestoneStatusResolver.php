<?php

namespace App\Domain\Projects\Services;

use App\Domain\Projects\Enums\MilestoneStatus;
use Carbon\CarbonInterface;

/**
 * Milestone status (docs/DATABASE.md §4): selesai / selesai terlambat
 * (completed office date after the target) / terlewat (target before today,
 * not completed) / berjalan (a linked task has started) / belum mulai.
 */
final class MilestoneStatusResolver
{
    public static function resolve(
        CarbonInterface $targetDate,
        ?CarbonInterface $completedAt,
        bool $hasStartedTasks,
        CarbonInterface $today,
    ): MilestoneStatus {
        $target = $targetDate->format('Y-m-d');

        if ($completedAt !== null) {
            return ProjectClock::date($completedAt) > $target ? MilestoneStatus::CompletedLate : MilestoneStatus::Completed;
        }

        if ($target < $today->format('Y-m-d')) {
            return MilestoneStatus::Missed;
        }

        return $hasStartedTasks ? MilestoneStatus::InProgress : MilestoneStatus::NotStarted;
    }
}
