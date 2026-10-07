<?php

namespace App\Domain\Workspaces\Enums;

/**
 * Groups of the workspace list (keputusan pemilik 6 Okt 2026): /workspace,
 * the mobile Menu and the Dock/Rail Workspace stack. The value is the
 * `?jenis=` filter. Mirrors resources/js/features/workspaces/groups.ts.
 */
enum WorkspaceGroup: string
{
    case Personal = 'pribadi';
    case DivisionTeam = 'divisi';
    case Project = 'proyek';
    /** Seen without membership (Direksi, internal visibility, Kepala Divisi). */
    case Other = 'lainnya';

    public function label(): string
    {
        return match ($this) {
            self::Personal => 'Pribadi',
            self::DivisionTeam => 'Divisi & tim',
            self::Project => 'Proyek yang diikuti',
            self::Other => 'Lainnya (lihat saja)',
        };
    }

    public static function of(WorkspaceType $type, bool $isMember): self
    {
        return match (true) {
            $type === WorkspaceType::Personal => self::Personal,
            ! $isMember => self::Other,
            $type === WorkspaceType::Project => self::Project,
            default => self::DivisionTeam,
        };
    }

    /**
     * `?jenis=` value, or null for "Semua" (unknown values too).
     */
    public static function fromQuery(mixed $value): ?self
    {
        return is_string($value) ? self::tryFrom($value) : null;
    }
}
