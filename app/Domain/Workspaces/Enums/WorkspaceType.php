<?php

namespace App\Domain\Workspaces\Enums;

/**
 * Workspace kinds (PRD M3). Personal and division workspaces are created
 * automatically; team and project workspaces are created manually.
 */
enum WorkspaceType: string
{
    case Personal = 'personal';
    case Team = 'team';
    case Division = 'division';
    case Project = 'project';

    public function label(): string
    {
        return match ($this) {
            self::Personal => 'Pribadi',
            self::Team => 'Tim',
            self::Division => 'Divisi',
            self::Project => 'Proyek',
        };
    }

    /**
     * Only team and project workspaces can be created from the UI.
     */
    public function isManual(): bool
    {
        return $this === self::Team || $this === self::Project;
    }

    /**
     * Sidebar group order: Pribadi, Divisi, Tim, Proyek.
     */
    public function sortOrder(): int
    {
        return match ($this) {
            self::Personal => 0,
            self::Division => 1,
            self::Team => 2,
            self::Project => 3,
        };
    }
}
