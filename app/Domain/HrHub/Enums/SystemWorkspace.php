<?php

namespace App\Domain\HrHub\Enums;

/**
 * System workspaces of Ruang HR (workspaces.system_key, keputusan pemilik
 * 20 Okt 2026): one of each per company, kept in line with the HR team by
 * EnsureHrWorkspaces. They cannot be archived, deleted or re-keyed.
 */
enum SystemWorkspace: string
{
    /** Shared notes of the HR team (Ruang HR › Catatan). */
    case HrTeam = 'hr_team';

    /** Tasks HR gives employees (Ruang HR › Penugasan); tasks_private. */
    case HrAssignments = 'hr_assignments';

    public function label(): string
    {
        return match ($this) {
            self::HrTeam => 'Tim HR',
            self::HrAssignments => 'Penugasan HR',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::HrTeam => 'Catatan bersama tim HR. Dikelola otomatis dari peran HR.',
            self::HrAssignments => 'Tugas dari HR untuk karyawan. Setiap karyawan hanya melihat tugas yang ditugaskan kepadanya.',
        };
    }

    /**
     * Preferred task prefix (WorkspaceKeyGenerator::PATTERN); a numeric suffix
     * is added when the key is already taken in the company.
     */
    public function keyPrefix(): string
    {
        return match ($this) {
            self::HrTeam => 'TIMHR',
            self::HrAssignments => 'PHR',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::HrTeam => 'teal',
            self::HrAssignments => 'amber',
        };
    }

    /**
     * Members below admin only see the tasks assigned to them.
     */
    public function tasksPrivate(): bool
    {
        return $this === self::HrAssignments;
    }
}
