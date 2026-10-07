<?php

namespace App\Domain\Meetings\Queries;

use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;

/**
 * Workspaces where the user can create tasks (WorkspacePolicy::canEditTasks):
 * the "Workspace" field of the meeting form and the "Jadikan tugas" target
 * for meetings without a workspace. Shared workspaces first, personal last.
 */
final class EditableWorkspaces
{
    public function __construct(private readonly WorkspacePolicy $policy) {}

    /**
     * @return list<array{id: string, key: string, name: string}>
     */
    public function for(User $user): array
    {
        return array_values(Workspace::query()
            ->visibleTo($user)
            ->notArchived()
            ->whereHas('members', fn ($member) => $member->where('users.id', $user->id))
            ->withMembershipOf($user)
            ->orderByRaw("CASE type WHEN 'personal' THEN 1 ELSE 0 END")
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'type', 'company_id', 'owner_id', 'visibility', 'archived_at'])
            ->filter(fn (Workspace $workspace): bool => $this->policy->canEditTasks($user, $workspace))
            ->map(fn (Workspace $workspace): array => ['id' => $workspace->id, 'key' => $workspace->key, 'name' => $workspace->name])
            ->all());
    }
}
