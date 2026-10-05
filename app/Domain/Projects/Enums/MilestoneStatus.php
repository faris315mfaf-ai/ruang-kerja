<?php

namespace App\Domain\Projects\Enums;

/**
 * Derived milestone status (docs/DATABASE.md §4 milestones).
 */
enum MilestoneStatus: string
{
    case NotStarted = 'not_started';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case CompletedLate = 'completed_late';
    case Missed = 'missed';

    public function label(): string
    {
        return match ($this) {
            self::NotStarted => 'Belum mulai',
            self::InProgress => 'Berjalan',
            self::Completed => 'Selesai',
            self::CompletedLate => 'Selesai terlambat',
            self::Missed => 'Terlewat',
        };
    }

    public function isDone(): bool
    {
        return $this === self::Completed || $this === self::CompletedLate;
    }
}
