<?php

namespace App\Domain\Workspaces\Enums;

/**
 * Role inside one workspace (workspace_members.role), independent of the
 * global spatie roles.
 */
enum WorkspaceRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Member = 'member';
    case Viewer = 'viewer';

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Owner',
            self::Admin => 'Admin',
            self::Member => 'Member',
            self::Viewer => 'Viewer',
        };
    }

    /**
     * Higher rank = more rights (owner 4 … viewer 1).
     */
    public function rank(): int
    {
        return match ($this) {
            self::Owner => 4,
            self::Admin => 3,
            self::Member => 2,
            self::Viewer => 1,
        };
    }

    public function atLeast(self $role): bool
    {
        return $this->rank() >= $role->rank();
    }

    /** Create, edit and move tasks. */
    public function canEditTasks(): bool
    {
        return $this->atLeast(self::Member);
    }

    /** Settings: members, statuses, labels, key. */
    public function canManage(): bool
    {
        return $this->atLeast(self::Admin);
    }

    /**
     * Roles that can be assigned from the members screen (owner is transferred, not assigned).
     *
     * @return list<self>
     */
    public static function assignable(): array
    {
        return [self::Admin, self::Member, self::Viewer];
    }
}
