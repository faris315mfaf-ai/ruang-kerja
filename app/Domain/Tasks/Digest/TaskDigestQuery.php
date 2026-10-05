<?php

namespace App\Domain\Tasks\Digest;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * Open tasks assigned to a user in workspaces they can see (non-archived),
 * shared by the digest sections.
 */
final class TaskDigestQuery
{
    /**
     * @return Builder<Task>
     */
    public static function assignedTo(User $user): Builder
    {
        return Task::query()
            ->visibleTo($user)
            ->open()
            ->whereIn('tasks.workspace_id', Workspace::query()->notArchived()->select('id'))
            ->whereExists(fn ($query) => $query->selectRaw('1')
                ->from('task_assignees')
                ->whereColumn('task_assignees.task_id', 'tasks.id')
                ->where('task_assignees.user_id', $user->id))
            ->with('workspace:id,key');
    }
}
