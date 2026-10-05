<?php

namespace App\Domain\Workspaces\Queries;

use App\Http\Resources\WorkspaceResource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Policies\WorkspacePolicy;
use Illuminate\Support\Facades\DB;

/**
 * Props shared by every workspace tab: header, abilities and members.
 */
final class WorkspacePage
{
    public function __construct(
        private readonly WorkspacePolicy $policy,
        private readonly WorkspaceDriveListing $drive,
    ) {}

    /**
     * @return array{workspace: array<string, mixed>, can: array<string, bool>, members: list<array{id: string, name: string, avatar: string|null, role: string}>, drive_counts: array{documents: int, files: int}}
     */
    public function props(Workspace $workspace, User $user): array
    {
        $workspace->loadCount('memberships as members_count');
        $workspace->setAttribute('member_divisions_count', DB::table('workspace_members')
            ->join('users', 'users.id', '=', 'workspace_members.user_id')
            ->where('workspace_members.workspace_id', $workspace->id)
            ->whereNotNull('users.division_id')
            ->distinct()
            ->count('users.division_id'));

        return [
            'workspace' => (new WorkspaceResource($workspace))->resolve(),
            'can' => $this->abilities($workspace, $user),
            'members' => $this->members($workspace),
            // Tab badges "Dokumen 6 · File 24" (Sprint 7).
            'drive_counts' => $this->drive->counts($workspace),
        ];
    }

    /**
     * @return array<string, bool>
     */
    public function abilities(Workspace $workspace, User $user): array
    {
        return [
            'edit_tasks' => $this->policy->editTasks($user, $workspace)->allowed(),
            'manage' => $this->policy->update($user, $workspace)->allowed(),
            'manage_members' => $this->policy->manageMembers($user, $workspace)->allowed(),
            'archive' => $this->policy->archive($user, $workspace)->allowed(),
            'favorite' => $this->policy->favorite($user, $workspace)->allowed(),
        ];
    }

    /**
     * Members ordered by role (owner first) then name.
     *
     * @return list<array{id: string, name: string, avatar: string|null, role: string}>
     */
    public function members(Workspace $workspace): array
    {
        // Uses eager-loaded `memberships.user` when present (lists of workspaces).
        $memberships = $workspace->relationLoaded('memberships')
            ? $workspace->memberships
            : WorkspaceMember::query()->where('workspace_id', $workspace->id)->with('user:id,name,avatar_url')->get();

        return array_values($memberships
            ->sortBy(fn (WorkspaceMember $member): string => (5 - $member->role->rank()).mb_strtolower($member->user->name))
            ->map(fn (WorkspaceMember $member): array => [
                'id' => $member->user_id,
                'name' => $member->user->name,
                'avatar' => $member->user->avatar_url,
                'role' => $member->role->value,
            ])
            ->all());
    }
}
