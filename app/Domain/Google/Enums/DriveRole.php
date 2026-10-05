<?php

namespace App\Domain\Google\Enums;

/**
 * Drive permission roles RuangKerja manages on workspace folders.
 */
enum DriveRole: string
{
    case Writer = 'writer';
    case Commenter = 'commenter';
    case Reader = 'reader';

    public function label(): string
    {
        return match ($this) {
            self::Writer => 'Dapat mengedit',
            self::Commenter => 'Dapat berkomentar',
            self::Reader => 'Hanya melihat',
        };
    }

    /**
     * Whether this role grants at least the access of `$other`.
     */
    public function covers(self $other): bool
    {
        return $this->rank() >= $other->rank();
    }

    private function rank(): int
    {
        return match ($this) {
            self::Writer => 3,
            self::Commenter => 2,
            self::Reader => 1,
        };
    }

    /**
     * Maps a workspace member role (workspace_members.role) to a Drive role:
     * owner/admin/member → writer, viewer → reader (docs/PROMPTS.md Sprint 7).
     */
    public static function forWorkspaceRole(string $workspaceRole): self
    {
        return $workspaceRole === 'viewer' ? self::Reader : self::Writer;
    }

    /**
     * Drive roles that grant more than `writer` on a folder (fileOrganizer,
     * organizer, owner) are treated as writer when comparing.
     */
    public static function fromDrive(string $role): ?self
    {
        return match ($role) {
            'owner', 'organizer', 'fileOrganizer', 'writer' => self::Writer,
            'commenter' => self::Commenter,
            'reader' => self::Reader,
            default => null,
        };
    }
}
