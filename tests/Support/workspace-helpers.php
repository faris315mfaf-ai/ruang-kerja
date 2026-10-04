<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

/*
 * Shared helpers for workspace & task tests (require_once in each file).
 */

if (! function_exists('addMember')) {
    function addMember(Workspace $workspace, User $user, WorkspaceRole $role = WorkspaceRole::Member, bool $synced = false): User
    {
        WorkspaceMember::query()->upsert([[
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'role' => $role->value,
            'is_synced' => $synced,
            'joined_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]], ['workspace_id', 'user_id'], ['role', 'is_synced']);

        return $user;
    }

    function memberWithRole(Workspace $workspace, WorkspaceRole $role, Role $globalRole = Role::Anggota): User
    {
        return addMember($workspace, User::factory()->withRole($globalRole)->create(), $role);
    }

    function statusOf(Workspace $workspace, string $category): TaskStatus
    {
        return TaskStatus::query()->where('workspace_id', $workspace->id)->where('category', $category)->firstOrFail();
    }

    /**
     * Ids of a column in board order.
     *
     * @return list<string>
     */
    function columnIds(TaskStatus $status): array
    {
        return Task::query()->where('status_id', $status->id)->orderBy('position')->orderBy('number')->pluck('id')->all();
    }
}
