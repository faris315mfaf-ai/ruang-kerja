<?php

namespace App\Http\Resources\Api;

use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;

/**
 * Why a workspace is read-only for the caller, in one place for the detail,
 * board and list endpoints. The reason strings are shown verbatim as the grey
 * banner of the app ("Workspace diarsipkan · hanya baca", mockup 16/21).
 */
final class WorkspaceAccess
{
    public const string ARCHIVED = 'Workspace diarsipkan · hanya baca.';

    public const string VIEW_ONLY = 'Mode lihat saja: Anda bukan anggota workspace ini.';

    public const string VIEWER = 'Peran Anda di workspace ini hanya bisa melihat.';

    /**
     * @return array{read_only: bool, reason: string|null, code: string|null}
     */
    public static function readOnly(Workspace $workspace, User $user, WorkspacePolicy $policy): array
    {
        [$code, $reason] = match (true) {
            $workspace->isArchived() => ['arsip', self::ARCHIVED],
            $policy->isViewOnly($user, $workspace) => ['lihat_saja', self::VIEW_ONLY],
            ! $policy->canEditTasks($user, $workspace) => ['peran_viewer', self::VIEWER],
            default => [null, null],
        };

        return ['read_only' => $code !== null, 'reason' => $reason, 'code' => $code];
    }
}
