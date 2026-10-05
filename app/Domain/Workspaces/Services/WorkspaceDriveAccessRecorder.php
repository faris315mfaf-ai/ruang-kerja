<?php

namespace App\Domain\Workspaces\Services;

use App\Domain\Google\Data\DriveMember;
use App\Domain\Google\Data\PermissionSyncResult;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Writes the outcome of a Drive permission sync onto workspace_members
 * (drive_access / drive_error / drive_synced_at). Plain query-builder
 * updates: `updated_at` keeps meaning "membership changed".
 */
final class WorkspaceDriveAccessRecorder
{
    /**
     * Reasons that are not a problem for the member (they have more access).
     */
    private const array HARMLESS_SKIPS = ['elevated_role'];

    /**
     * @param  list<DriveMember>  $members
     */
    public function synced(Workspace $workspace, array $members, PermissionSyncResult $result): void
    {
        $desired = [];

        foreach ($members as $member) {
            $desired[$member->email] = $member->role->value;
        }

        $rows = DB::table('workspace_members')
            ->join('users', 'users.id', '=', 'workspace_members.user_id')
            ->where('workspace_members.workspace_id', $workspace->id)
            ->get(['workspace_members.user_id', 'users.email']);

        $now = now();

        DB::transaction(function () use ($rows, $desired, $result, $workspace, $now): void {
            foreach ($rows as $row) {
                $email = strtolower(trim((string) $row->email));
                $skipped = $result->skipped[$email] ?? null;

                if ($skipped !== null && in_array($skipped, self::HARMLESS_SKIPS, true)) {
                    $skipped = null;
                }

                $values = match (true) {
                    $skipped !== null => ['drive_access' => null, 'drive_error' => mb_substr($skipped, 0, 100)],
                    isset($desired[$email]) => ['drive_access' => $desired[$email], 'drive_error' => null],
                    // Not desired (inactive employee): access was revoked.
                    default => ['drive_access' => null, 'drive_error' => null],
                };

                DB::table('workspace_members')
                    ->where('workspace_id', $workspace->id)
                    ->where('user_id', $row->user_id)
                    ->update($values + ['drive_synced_at' => $now]);
            }
        });
    }

    /**
     * Members whose confirmed access does not match their role get the error.
     */
    public function failed(Workspace $workspace, string $reason): void
    {
        DB::table('workspace_members')
            ->where('workspace_id', $workspace->id)
            ->whereRaw("drive_access IS DISTINCT FROM (CASE WHEN role = 'viewer' THEN 'reader' ELSE 'writer' END)")
            ->update(['drive_error' => mb_substr($reason, 0, 100), 'drive_synced_at' => now()]);
    }
}
