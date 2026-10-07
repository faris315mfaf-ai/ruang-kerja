<?php

namespace App\Domain\Reports\Queries;

use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Search\Support\LikePattern;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\Gate;

/**
 * Tasks offered in the daily report form: suggestions (planned "Hari ini" in
 * Ruang saya, open tasks assigned to me, open tasks of my personal workspace)
 * and a search over every task I can see. Each option carries the columns of
 * its workspace when I may move it ("pindahkan ke …").
 */
final class ReportTaskOptions
{
    public const int SUGGESTIONS = 40;

    public const int SEARCH = 20;

    /**
     * @return list<array<string, mixed>>
     */
    public function suggestions(User $user): array
    {
        $personal = Workspace::query()
            ->where('type', WorkspaceType::Personal->value)
            ->where('owner_id', $user->id)
            ->select('id');

        $tasks = $this->base($user)
            ->leftJoin('task_plans', fn (JoinClause $join) => $join
                ->on('task_plans.task_id', '=', 'tasks.id')
                ->where('task_plans.user_id', '=', $user->id))
            ->addSelect(['task_plans.bucket as plan_bucket'])
            ->whereNotIn('tasks.status_category', TaskStatusCategory::closedValues())
            ->where(fn (Builder $query) => $query
                ->where('task_plans.bucket', PlanBucket::Today->value)
                ->orWhereExists(fn ($assigned) => $assigned->selectRaw('1')->from('task_assignees')
                    ->whereColumn('task_assignees.task_id', 'tasks.id')
                    ->where('task_assignees.user_id', $user->id))
                ->orWhereIn('tasks.workspace_id', $personal))
            ->orderByRaw('case when task_plans.bucket = ? then 0 else 1 end', [PlanBucket::Today->value])
            ->orderByRaw("case when tasks.status_category = 'in_progress' then 0 else 1 end")
            ->orderByRaw('tasks.due_date asc nulls last')
            ->orderBy('tasks.created_at')
            ->limit(self::SUGGESTIONS)
            ->get();

        return $this->present($user, $tasks);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function search(User $user, string $term): array
    {
        $term = trim($term);

        if (mb_strlen($term) < 2) {
            return [];
        }

        $pattern = LikePattern::contains($term);
        $number = preg_match('/^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/', $term, $match) === 1 ? $match : null;

        $tasks = $this->base($user)
            ->where(fn (Builder $query) => $query
                ->where('tasks.title', 'ilike', $pattern)
                ->when($number !== null, fn (Builder $key) => $key->orWhere(fn (Builder $exact) => $exact
                    ->where('tasks.number', (int) ($number[2] ?? 0))
                    ->whereIn('tasks.workspace_id', Workspace::query()->whereRaw('upper(key) = ?', [mb_strtoupper((string) ($number[1] ?? ''))])->select('id')))))
            ->orderByRaw("case when tasks.status_category in ('done', 'canceled') then 1 else 0 end")
            ->orderByDesc('tasks.updated_at')
            ->limit(self::SEARCH)
            ->get();

        return $this->present($user, $tasks);
    }

    /**
     * Options of tasks already on a report (so their columns are known).
     *
     * @param  list<string>  $ids
     * @return list<array<string, mixed>>
     */
    public function byIds(User $user, array $ids): array
    {
        return $ids === [] ? [] : $this->present($user, $this->base($user)->whereIn('tasks.id', $ids)->get());
    }

    /**
     * @return Builder<Task>
     */
    private function base(User $user): Builder
    {
        return Task::query()
            ->select('tasks.*')
            ->whereIn('tasks.workspace_id', Workspace::query()->visibleTo($user)->notArchived()->select('id'))
            ->with([
                'workspace',
                // The writer's membership row: the move() check needs no extra query.
                'workspace.membership' => fn (Relation $membership) => $membership->where('user_id', $user->id),
                'status:id,workspace_id,name,category',
            ]);
    }

    /**
     * @param  Collection<int, Task>  $tasks
     * @return list<array<string, mixed>>
     */
    private function present(User $user, Collection $tasks): array
    {
        /** @var array<string, true> $movable */
        $movable = [];

        foreach ($tasks as $task) {
            if (Gate::forUser($user)->allows('move', $task)) {
                $movable[$task->id] = true;
            }
        }

        $columns = TaskStatus::query()
            ->whereIn('workspace_id', $tasks->filter(fn (Task $task): bool => isset($movable[$task->id]))->pluck('workspace_id')->unique()->values())
            ->orderBy('position')
            ->get(['id', 'workspace_id', 'name', 'category'])
            ->groupBy('workspace_id');

        return array_values($tasks->map(fn (Task $task): array => [
            'id' => $task->id,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'workspace' => ['id' => $task->workspace->id, 'key' => $task->workspace->key, 'name' => $task->workspace->name, 'type' => $task->workspace->type->value],
            'status' => ['id' => $task->status->id, 'name' => $task->status->name, 'category' => $task->status->category->value],
            'due_date' => $task->due_date?->toDateString(),
            'planned_today' => ($task->getAttributes()['plan_bucket'] ?? null) === PlanBucket::Today->value,
            'can_move' => isset($movable[$task->id]),
            'statuses' => isset($movable[$task->id])
                ? array_values(($columns->get($task->workspace_id) ?? collect())->map(fn (TaskStatus $status): array => [
                    'id' => $status->id,
                    'name' => $status->name,
                    'category' => $status->category->value,
                ])->all())
                : [],
        ])->all());
    }
}
