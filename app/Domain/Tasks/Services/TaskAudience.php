<?php

namespace App\Domain\Tasks\Services;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Policies\WorkspacePolicy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Who may be mentioned (@) in a workspace: exactly the people who can see
 * it (WorkspacePolicy::canView). Suggestions list members, plus every active
 * employee of the company for `internal` workspaces; the final check of a
 * mention always runs the policy per person, so a mention of someone
 * outside a private workspace never creates a row or a notification.
 */
final class TaskAudience
{
    public function __construct(private readonly WorkspacePolicy $policy) {}

    /**
     * People with access among $userIds (same company, active, policy allows).
     *
     * @param  list<string>  $userIds
     * @return Collection<int, User>
     */
    public function withAccess(Workspace $workspace, array $userIds): Collection
    {
        if ($userIds === []) {
            return new Collection;
        }

        // Memberships loaded once: members of a shared workspace see it without a
        // per-user roleOf() query; only non-members go through the full policy.
        $members = $workspace->isPersonal() ? [] : array_flip(WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('user_id', $userIds)
            ->pluck('user_id')
            ->all());

        return User::query()
            ->where('company_id', $workspace->company_id)
            ->active()
            ->whereIn('id', $userIds)
            ->with(['roles.permissions', 'permissions'])
            ->get()
            ->filter(fn (User $user): bool => isset($members[$user->id]) || $this->policy->canView($user, $workspace))
            ->values();
    }

    /**
     * People among $userIds who can see this task: withAccess() plus the
     * private-task rule (Penugasan HR) — only the workspace's owner/admins
     * and the task's assignees. Use it for every task notification.
     *
     * @param  list<string>  $userIds
     * @return Collection<int, User>
     */
    public function withTaskAccess(Task $task, array $userIds): Collection
    {
        $people = $this->withAccess($task->workspace, $userIds);

        if ($people->isEmpty() || ! $task->workspace->hasPrivateTasks()) {
            return $people;
        }

        $admins = WorkspaceMember::query()
            ->where('workspace_id', $task->workspace_id)
            ->whereIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('user_id')
            ->all();
        $allowed = array_flip([...$admins, ...$task->assignees()->pluck('users.id')->all()]);

        return $people->filter(fn (User $user): bool => isset($allowed[$user->id]))->values();
    }

    public function canAccess(Workspace $workspace, User $user): bool
    {
        return $this->policy->canView($user, $workspace);
    }

    /**
     * Mention suggestions for the "@" popup.
     *
     * @return Collection<int, User>
     */
    public function suggestions(Workspace $workspace, string $query, int $limit = 8): Collection
    {
        $pattern = '%'.addcslashes(trim($query), '%_\\').'%';

        return User::query()
            ->where('company_id', $workspace->company_id)
            ->active()
            ->when(! $this->isOpenToCompany($workspace), fn (Builder $scope) => $scope->whereIn(
                'id',
                WorkspaceMember::query()->where('workspace_id', $workspace->id)
                    // Penugasan HR: suggest HR only, never the other employees.
                    ->when($workspace->hasPrivateTasks(), fn (Builder $member) => $member->whereIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value]))
                    ->select('user_id'),
            ))
            ->when(trim($query) !== '', fn (Builder $scope) => $scope->where(fn (Builder $match) => $match
                ->where('name', 'ilike', $pattern)
                ->orWhere('email', 'ilike', $pattern)))
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'email', 'avatar_url', 'company_id', 'status']);
    }

    private function isOpenToCompany(Workspace $workspace): bool
    {
        return ! $workspace->isPersonal() && $workspace->visibility === WorkspaceVisibility::Internal;
    }
}
