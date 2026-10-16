<?php

namespace App\Domain\Tasks\Enums;

/**
 * tasks.source: how the task came to exist. `attendance` marks the tasks
 * generated from a work-plan point at check-in (keputusan pemilik 9 Okt
 * 2026) — they live in the employee's personal workspace and are editable
 * like any self-created task.
 */
enum TaskSource: string
{
    case Manual = 'manual';
    case Attendance = 'attendance';

    public function label(): string
    {
        return match ($this) {
            self::Manual => 'Manual',
            self::Attendance => 'Absensi',
        };
    }
}
