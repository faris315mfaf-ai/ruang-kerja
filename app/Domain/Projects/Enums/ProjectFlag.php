<?php

namespace App\Domain\Projects\Enums;

/**
 * System flags shown next to the PIC health (PRD M10 "Penanda sistem").
 */
enum ProjectFlag: string
{
    /** Actual − planned ≤ −15 percentage points. */
    case Behind = 'behind';
    /** At least one milestone past its target date and not completed. */
    case MissedMilestone = 'missed_milestone';
    /** Last update older than 7 days (or none yet). */
    case StaleUpdate = 'stale_update';

    public function label(): string
    {
        return match ($this) {
            self::Behind => 'Tertinggal',
            self::MissedMilestone => 'Milestone terlewat',
            self::StaleUpdate => 'Update kedaluwarsa',
        };
    }
}
