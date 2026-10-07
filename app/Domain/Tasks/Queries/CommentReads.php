<?php

namespace App\Domain\Tasks\Queries;

use App\Http\Resources\PersonResource;
use App\Models\Task;
use App\Models\TaskCommentRead;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Read pointers of a task ("Dibaca oleh"), as shown in the task detail. Only
 * people who still take part in the task are listed: active employees of the
 * company who can see the workspace and are not view-only management
 * (TaskPolicy::trackCommentReads). A pointer left behind by someone who lost
 * access stays in the table but is never shown.
 *
 * Constant number of queries: the pointers with their users (2); non-members
 * of a shared workspace (internal workspaces, a Kepala Divisi of an involved
 * division) additionally load their roles once (3) for the policy check.
 */
final class CommentReads
{
    public function __construct(private readonly WorkspacePolicy $policy) {}

    /**
     * @param  list<string>  $memberIds  workspace_members user ids (the caller already has them)
     * @return list<array{user: array{id: string, name: string, avatar: string|null}, last_read_comment_id: string, last_read_at: string, read_at: string}>
     */
    public function forTask(Task $task, Workspace $workspace, array $memberIds): array
    {
        $reads = TaskCommentRead::query()
            ->where('task_id', $task->id)
            ->whereHas('user', fn (Builder $query) => $query->active()->where('company_id', $workspace->company_id))
            ->with('user:id,name,avatar_url,company_id,status')
            ->orderByDesc('updated_at')
            ->get();

        $members = array_flip($memberIds);
        $outsiders = new Collection($reads
            ->map(fn (TaskCommentRead $read): User => $read->user)
            ->reject(fn (User $user): bool => $workspace->isPersonal() || isset($members[$user->id]))
            ->values()
            ->all());

        if ($outsiders->isNotEmpty()) {
            $outsiders->load(['roles.permissions', 'permissions']);
        }

        return array_values($reads
            ->filter(fn (TaskCommentRead $read): bool => $this->takesPart($read->user, $workspace, $members))
            ->map(fn (TaskCommentRead $read): array => [
                'user' => PersonResource::from($read->user),
                'last_read_comment_id' => $read->last_read_comment_id,
                'last_read_at' => $read->last_read_at->toIso8601String(),
                'read_at' => ($read->updated_at ?? $read->last_read_at)->toIso8601String(),
            ])
            ->all());
    }

    /**
     * @param  array<string, int>  $members
     */
    private function takesPart(User $user, Workspace $workspace, array $members): bool
    {
        if ($workspace->isPersonal()) {
            return $workspace->owner_id === $user->id;
        }

        if (isset($members[$user->id])) {
            return true;
        }

        // Not a member: view-only management is never listed; others (internal
        // workspace, Kepala Divisi of an involved division) need the policy.
        return ! Workspace::seesAllShared($user) && $this->policy->canView($user, $workspace);
    }
}
