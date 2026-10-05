<?php

namespace App\Domain\Workspaces\Enums;

use App\Domain\Google\Enums\DriveRole;

/**
 * "Akses Drive" of one workspace member (Pengaturan › Anggota, mockup
 * WorkspacePengaturan), derived from workspace_members.drive_access /
 * drive_error and the member's current role.
 */
enum DriveAccessStatus: string
{
    case Synced = 'synced';
    case Pending = 'pending';
    case Error = 'error';
    /** Employee is inactive: no Drive access by design. */
    case Inactive = 'inactive';
    /** Google Drive is not configured for RuangKerja. */
    case Disabled = 'disabled';

    public function label(): string
    {
        return match ($this) {
            self::Synced => 'Tersinkron',
            self::Pending => 'Menunggu sinkron',
            self::Error => 'Gagal sinkron',
            self::Inactive => 'Akun nonaktif',
            self::Disabled => 'Drive belum aktif',
        };
    }

    /**
     * @param  string|null  $confirmed  workspace_members.drive_access
     * @param  string|null  $error  workspace_members.drive_error
     */
    public static function resolve(
        WorkspaceRole $role,
        ?string $confirmed,
        ?string $error,
        bool $userActive,
        bool $driveEnabled,
    ): self {
        return match (true) {
            ! $driveEnabled => self::Disabled,
            ! $userActive => self::Inactive,
            $error !== null => self::Error,
            $confirmed === DriveRole::forWorkspaceRole($role->value)->value => self::Synced,
            default => self::Pending,
        };
    }
}
