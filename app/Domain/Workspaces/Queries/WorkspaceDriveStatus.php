<?php

namespace App\Domain\Workspaces\Queries;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Workspaces\Enums\DriveAccessStatus;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Drive access of a workspace: per member ("Akses Drive" column) and the
 * folder summary badge ("Akses tersinkron · 9 anggota").
 */
final class WorkspaceDriveStatus
{
    /**
     * @return array<string, array{status: string, label: string, error: string|null, synced_at: string|null}> keyed by user id
     */
    public function members(Workspace $workspace): array
    {
        $enabled = GoogleFeatures::enabled($workspace->company_id);
        $members = [];

        $rows = DB::table('workspace_members')
            ->join('users', 'users.id', '=', 'workspace_members.user_id')
            ->where('workspace_members.workspace_id', $workspace->id)
            ->get(['workspace_members.user_id', 'workspace_members.role', 'workspace_members.drive_access', 'workspace_members.drive_error', 'workspace_members.drive_synced_at', 'users.status']);

        foreach ($rows as $row) {
            $status = DriveAccessStatus::resolve(
                WorkspaceRole::from((string) $row->role),
                self::stringOrNull($row->drive_access),
                self::stringOrNull($row->drive_error),
                UserStatus::tryFrom((string) $row->status)?->canSignIn() ?? false,
                $enabled,
            );

            $members[(string) $row->user_id] = [
                'status' => $status->value,
                'label' => $status->label(),
                'error' => $status === DriveAccessStatus::Error ? self::stringOrNull($row->drive_error) : null,
                'synced_at' => self::stringOrNull($row->drive_synced_at) === null ? null : CarbonImmutable::parse((string) $row->drive_synced_at)->toIso8601String(),
            ];
        }

        return $members;
    }

    /**
     * @return array{state: string, synced: int, pending: int, errors: int, total: int}
     *
     * state: disabled | preparing (folder not created yet) | unused (personal,
     * created on first use) | error | pending | synced
     */
    public function summary(Workspace $workspace): array
    {
        $counts = ['synced' => 0, 'pending' => 0, 'errors' => 0, 'total' => 0];

        foreach ($this->members($workspace) as $member) {
            match ($member['status']) {
                DriveAccessStatus::Synced->value => $counts['synced']++,
                DriveAccessStatus::Pending->value => $counts['pending']++,
                DriveAccessStatus::Error->value => $counts['errors']++,
                default => null,
            };

            if ($member['status'] !== DriveAccessStatus::Inactive->value) {
                $counts['total']++;
            }
        }

        // A queued job may have stored the folder after this model was loaded.
        $folderId = $workspace->drive_folder_id ?? Workspace::query()->whereKey($workspace->id)->value('drive_folder_id');

        $state = match (true) {
            ! GoogleFeatures::enabled($workspace->company_id) => 'disabled',
            $folderId === null => $workspace->isPersonal() ? 'unused' : 'preparing',
            $counts['errors'] > 0 => 'error',
            $counts['pending'] > 0 => 'pending',
            default => 'synced',
        };

        return ['state' => $state] + $counts;
    }

    private static function stringOrNull(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }
}
