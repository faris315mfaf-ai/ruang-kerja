<?php

namespace App\Http\Resources\Api;

use App\Domain\Workspaces\Enums\WorkspaceGroup;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\User;
use App\Models\Workspace;

/**
 * One workspace row of the mobile list (GET /workspace): the identity fields
 * of the web directory card plus the badges the app shows (members, open and
 * overdue tasks, my role, favorite). Expects `membership` eager-loaded
 * (Workspace::withMembershipOf) and the withCount aliases `members_count`,
 * `open_tasks_count` and `overdue_tasks_count`; nothing here queries.
 */
final class WorkspaceSummary
{
    /**
     * @return array<string, mixed>
     */
    public static function item(Workspace $workspace, User $viewer, bool $seesAllShared): array
    {
        $personal = $workspace->type === WorkspaceType::Personal;
        $isMember = $personal ? $workspace->owner_id === $viewer->id : $workspace->membership !== null;
        $attributes = $workspace->getAttributes();

        return [
            'id' => $workspace->id,
            'key' => $workspace->key,
            'name' => $workspace->name,
            'arsip' => $workspace->isArchived(),
            'type' => $workspace->type->value,
            'type_label' => $workspace->type->label(),
            'group' => WorkspaceGroup::of($workspace->type, $isMember)->value,
            'color' => $workspace->color ?? 'gray',
            'visibility' => $workspace->visibility->value,
            'is_member' => $isMember,
            'my_role' => $personal ? ($isMember ? 'owner' : null) : $workspace->membership?->role->value,
            'favorit' => $workspace->membership?->favorited_at !== null,
            'view_only' => ! $personal && ! $isMember && $seesAllShared,
            'members_count' => (int) ($attributes['members_count'] ?? 0),
            'open_tasks_count' => (int) ($attributes['open_tasks_count'] ?? 0),
            'overdue_tasks_count' => (int) ($attributes['overdue_tasks_count'] ?? 0),
        ];
    }
}
