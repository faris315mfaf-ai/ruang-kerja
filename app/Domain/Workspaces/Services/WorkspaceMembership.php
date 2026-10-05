<?php

namespace App\Domain\Workspaces\Services;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

/**
 * Small write helpers for workspace_members (composite key, so no save()).
 */
final class WorkspaceMembership
{
    public function put(Workspace $workspace, string $userId, WorkspaceRole $role, bool $synced = false): void
    {
        $now = now();

        WorkspaceMember::query()->upsert([[
            'workspace_id' => $workspace->id,
            'user_id' => $userId,
            'role' => $role->value,
            'is_synced' => $synced,
            'joined_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]], ['workspace_id', 'user_id'], ['role', 'updated_at']);
    }

    /**
     * @return list<string>
     */
    public function userIds(Workspace $workspace): array
    {
        /** @var list<string> */
        return WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->pluck('user_id')
            ->all();
    }
}
