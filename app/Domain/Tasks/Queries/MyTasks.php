<?php

namespace App\Domain\Tasks\Queries;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * "Tugas saya" across workspaces: assigned to me, watched (without being
 * assigned) or created by me. Only visible, non-archived workspaces; open
 * tasks plus tasks completed since the start of this week.
 */
final class MyTasks
{
    public const array TABS = ['assigned', 'watching', 'created'];

    /**
     * @return Collection<int, Task>
     */
    public function for(User $user, string $tab, CarbonImmutable $weekStart): Collection
    {
        return $this->query($user, $tab, $weekStart)
            ->with(['workspace.statuses', 'status', 'labels', 'assignees:id,name,avatar_url', 'parent:id,number'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ])
            ->orderByRaw('due_date asc nulls last')
            ->orderBy('priority')
            ->orderBy('number')
            ->get();
    }

    /**
     * The rows of a tab without eager loads or order (also the mobile API
     * list): open tasks plus tasks completed since $weekStart, in visible,
     * non-archived workspaces.
     *
     * @return Builder<Task>
     */
    public function query(User $user, string $tab, CarbonImmutable $weekStart): Builder
    {
        return $this->scoped($user, $tab)
            ->where(fn (Builder $query) => $query->open()->orWhere('tasks.completed_at', '>=', $weekStart));
    }

    /**
     * Open task count per tab.
     *
     * @return array<string, int>
     */
    public function counts(User $user): array
    {
        $counts = [];

        foreach (self::TABS as $tab) {
            $counts[$tab] = $this->scoped($user, $tab)->open()->count();
        }

        return $counts;
    }

    /**
     * @return Builder<Task>
     */
    private function scoped(User $user, string $tab): Builder
    {
        $query = Task::query()
            ->whereIn('tasks.workspace_id', Workspace::query()->visibleTo($user)->notArchived()->select('id'))
            ->respectingPrivacyOf($user);

        $assigned = fn (QueryBuilder $sub) => $sub->selectRaw('1')
            ->from('task_assignees')
            ->whereColumn('task_assignees.task_id', 'tasks.id')
            ->where('task_assignees.user_id', $user->id);

        return match ($tab) {
            'watching' => $query
                ->whereExists(fn (QueryBuilder $sub) => $sub->selectRaw('1')
                    ->from('task_watchers')
                    ->whereColumn('task_watchers.task_id', 'tasks.id')
                    ->where('task_watchers.user_id', $user->id))
                ->whereNotExists($assigned),
            'created' => $query->where('tasks.created_by', $user->id),
            default => $query->whereExists($assigned),
        };
    }
}
