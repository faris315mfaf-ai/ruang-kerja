<?php

namespace App\Domain\Workspaces\Services;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

/**
 * Reconciles the synced members of a division/team workspace with the
 * organization: adds missing people (is_synced = true), removes synced rows of
 * people who left, never touches manually added members, and keeps role
 * changes made by admins (only ownership is enforced: the owner row follows
 * workspaces.owner_id; a former owner falls back to the synced role while
 * still in the division/team, and a synced former owner who is not is removed).
 */
final class MemberSynchronizer
{
    public function __construct(private readonly RemovedMembersCleanup $cleanup) {}

    /**
     * @param  array<string, WorkspaceRole>  $desired  user id => role for new rows
     */
    public function sync(Workspace $workspace, array $desired): void
    {
        /** @var array<string, WorkspaceMember> $existing */
        $existing = WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->get()
            ->keyBy('user_id')
            ->all();

        $now = now();
        $added = [];
        $removed = [];
        $changed = false;

        foreach ($desired as $userId => $role) {
            $row = $existing[$userId] ?? null;

            if ($row === null) {
                WorkspaceMember::query()->insert([
                    'workspace_id' => $workspace->id,
                    'user_id' => $userId,
                    'role' => $role->value,
                    'is_synced' => true,
                    'joined_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $added[] = $userId;

                continue;
            }

            // Ownership follows workspaces.owner_id (e.g. a new Kepala Divisi).
            $ownerChange = ($role === WorkspaceRole::Owner) !== ($row->role === WorkspaceRole::Owner);

            if ($ownerChange) {
                $this->setRole($workspace, $userId, $role);
                $changed = true;
            }
        }

        foreach ($existing as $userId => $row) {
            if (isset($desired[$userId])) {
                continue;
            }

            if ($row->is_synced && $userId !== $workspace->owner_id) {
                WorkspaceMember::query()
                    ->where('workspace_id', $workspace->id)
                    ->where('user_id', $userId)
                    ->delete();
                $removed[] = $userId;

                continue;
            }

            // A manually added former owner (legacy rows) keeps access as admin.
            if ($row->role === WorkspaceRole::Owner && $userId !== $workspace->owner_id) {
                $this->setRole($workspace, $userId, WorkspaceRole::Admin);
                $changed = true;
            }
        }

        $this->cleanup->handle($workspace, $removed);

        if ($added !== [] || $removed !== [] || $changed) {
            WorkspaceMembersChanged::dispatch($workspace, $added, $removed);
        }
    }

    private function setRole(Workspace $workspace, string $userId, WorkspaceRole $role): void
    {
        WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $userId)
            ->update(['role' => $role->value, 'updated_at' => now()]);
    }
}
