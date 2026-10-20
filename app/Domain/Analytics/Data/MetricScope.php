<?php

namespace App\Domain\Analytics\Data;

use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Who a metric is about and through whose eyes.
 *
 * - `userIds`: the people measured (attendance rows, task assignees). Always
 *   derived from a `visibleTo($viewer)` scope by the dashboard queries.
 * - Tasks are attributed to people through `task_assignees` and only count
 *   when they live in a workspace the viewer may see
 *   (`Workspace::visibleTo`). Personal workspaces only count on the viewer's
 *   own dashboard (`includePersonal`), so private to-dos never leak into team
 *   numbers.
 */
final readonly class MetricScope
{
    /**
     * @param  list<string>  $userIds
     */
    public function __construct(
        public User $viewer,
        public array $userIds,
        public bool $includePersonal = false,
    ) {}

    public static function personal(User $user): self
    {
        return new self($user, [$user->id], includePersonal: true);
    }

    /**
     * Tasks in workspaces the viewer may see (no assignee filter). Archived
     * workspaces are frozen history and never count toward live metrics.
     *
     * @return Builder<Task>
     */
    public function visibleTasks(): Builder
    {
        $workspaces = Workspace::query()->visibleTo($this->viewer)->notArchived();

        if (! $this->includePersonal) {
            $workspaces->where('workspaces.type', '!=', WorkspaceType::Personal->value);
        }

        return Task::query()->whereIn('tasks.workspace_id', $workspaces->select('workspaces.id'))->respectingPrivacyOf($this->viewer);
    }

    /**
     * Visible tasks with at least one assignee in scope (each task once).
     *
     * @return Builder<Task>
     */
    public function tasks(): Builder
    {
        return $this->visibleTasks()->whereExists(fn (QueryBuilder $assignee) => $assignee->selectRaw('1')
            ->from('task_assignees')
            ->whereColumn('task_assignees.task_id', 'tasks.id')
            ->whereIn('task_assignees.user_id', $this->userIds));
    }

    /**
     * Stable fingerprint for cache keys: viewer (task visibility) + people.
     */
    public function fingerprint(): string
    {
        $ids = $this->userIds;
        sort($ids);

        return sha1($this->viewer->id.'|'.($this->includePersonal ? 'p' : 's').'|'.implode(',', $ids));
    }
}
