<?php

namespace App\Domain\Tasks\Queries;

use App\Domain\Planner\Services\LanePlacement;
use App\Domain\Search\Support\LikePattern;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * The mobile "Tugas saya" list: MyTasks (assigned · watching · created) or,
 * with no scope, every visible task — then filtered, sorted and summarised.
 * Always inside Task::visibleTo / MyTasks, so a filter can never reveal a
 * task of a workspace the user may not see. Sorting always ends with
 * tasks.id, so offset pages never repeat or skip a row.
 *
 * Criteria (all optional; the FormRequest validates them):
 *   scope      assigned | watching | created | null (all visible)
 *   workspaces keys or ids          priorities  0-4
 *   statuses   status categories    labels      label ids
 *   assignees  user ids ("me" = viewer)
 *   due        overdue | today | week | none    due_from / due_to  Y-m-d
 *   q          title or KEY-n       completed   week | none
 *   sort       due | priority | created | updated | title | workspace
 *   direction  asc | desc
 *
 * @phpstan-type Criteria array{
 *     scope?: string|null,
 *     workspaces?: list<string>,
 *     priorities?: list<int>,
 *     statuses?: list<string>,
 *     labels?: list<string>,
 *     assignees?: list<string>,
 *     due?: string|null,
 *     due_from?: string|null,
 *     due_to?: string|null,
 *     q?: string,
 *     completed?: string,
 *     sort?: string,
 *     direction?: string,
 * }
 */
final class MyTaskList
{
    public function __construct(private readonly MyTasks $myTasks) {}

    /**
     * Rows the criteria select, ordered, without eager loads.
     *
     * @param  Criteria  $criteria
     * @return Builder<Task>
     */
    public function query(User $user, array $criteria, CarbonImmutable $today): Builder
    {
        $query = $this->base($user, $criteria['scope'] ?? null, $today);

        if (($criteria['completed'] ?? 'week') === 'none') {
            $query->open();
        }

        $this->filter($query, $user, $criteria, $today);
        $this->sort($query, $criteria['sort'] ?? 'due', ($criteria['direction'] ?? 'asc') === 'desc');

        return $query;
    }

    /**
     * Header numbers ("9 aktif · 1 terlambat · 2 hari ini") of the scope —
     * open tasks only, before any filter, so the header never changes with
     * the chips under it.
     *
     * @return array{aktif: int, terlambat: int, hari_ini: int}
     */
    public function summary(User $user, ?string $scope, CarbonImmutable $today): array
    {
        $row = $this->base($user, $scope, $today)
            ->open()
            ->toBase()
            ->selectRaw(
                'count(*) as aktif, count(*) filter (where tasks.due_date < ?) as terlambat, count(*) filter (where tasks.due_date = ?) as hari_ini',
                [$today->toDateString(), $today->toDateString()],
            )
            ->first();

        return [
            'aktif' => (int) ($row->aktif ?? 0),
            'terlambat' => (int) ($row->terlambat ?? 0),
            'hari_ini' => (int) ($row->hari_ini ?? 0),
        ];
    }

    /**
     * Open task count per scope, keyed by the API scope names.
     *
     * @return array{ditugaskan: int, 'saya-amati': int, 'saya-buat': int}
     */
    public function counts(User $user): array
    {
        $counts = $this->myTasks->counts($user);

        return [
            'ditugaskan' => $counts['assigned'] ?? 0,
            'saya-amati' => $counts['watching'] ?? 0,
            'saya-buat' => $counts['created'] ?? 0,
        ];
    }

    /**
     * @return Builder<Task>
     */
    private function base(User $user, ?string $scope, CarbonImmutable $today): Builder
    {
        $weekStart = $today->startOfWeek(CarbonImmutable::MONDAY)->utc();

        if ($scope !== null) {
            return $this->myTasks->query($user, $scope, $weekStart);
        }

        return Task::query()
            ->visibleTo($user)
            ->where(fn (Builder $query): Builder => $query->open()->orWhere('tasks.completed_at', '>=', $weekStart));
    }

    /**
     * @param  Builder<Task>  $query
     * @param  Criteria  $criteria
     */
    private function filter(Builder $query, User $user, array $criteria, CarbonImmutable $today): void
    {
        $workspaces = $criteria['workspaces'] ?? [];

        if ($workspaces !== []) {
            $keys = array_map(mb_strtoupper(...), $workspaces);
            $ids = array_map(mb_strtolower(...), $workspaces);
            $query->whereIn('tasks.workspace_id', Workspace::query()
                ->visibleTo($user)
                ->where(fn (Builder $match): Builder => $match->whereIn('key', $keys)->orWhereIn('id', $ids))
                ->select('id'));
        }

        if (($criteria['priorities'] ?? []) !== []) {
            $query->whereIn('tasks.priority', $criteria['priorities']);
        }

        if (($criteria['statuses'] ?? []) !== []) {
            $query->whereIn('tasks.status_category', $criteria['statuses']);
        }

        if (($criteria['labels'] ?? []) !== []) {
            $labels = array_map(mb_strtolower(...), $criteria['labels']);
            $query->whereExists(fn (QueryBuilder $sub) => $sub->selectRaw('1')
                ->from('task_labels')
                ->whereColumn('task_labels.task_id', 'tasks.id')
                ->whereIn('task_labels.label_id', $labels));
        }

        if (($criteria['assignees'] ?? []) !== []) {
            $people = array_map(fn (string $id): string => $id === 'me' ? $user->id : mb_strtolower($id), $criteria['assignees']);
            $query->whereExists(fn (QueryBuilder $sub) => $sub->selectRaw('1')
                ->from('task_assignees')
                ->whereColumn('task_assignees.task_id', 'tasks.id')
                ->whereIn('task_assignees.user_id', $people));
        }

        $this->filterDue($query, $criteria, $today);

        $term = trim($criteria['q'] ?? '');

        if ($term !== '') {
            $reference = preg_match('/^(?:([A-Za-z][A-Za-z0-9]{1,9})-)?(\d{1,9})$/', $term, $match) === 1 ? $match : null;
            $query->where(function (Builder $search) use ($term, $reference): void {
                $search->where('tasks.title', 'ilike', LikePattern::contains($term));

                if ($reference !== null && $reference[1] !== '') {
                    $search->orWhere(fn (Builder $key) => $key
                        ->where('tasks.number', (int) $reference[2])
                        ->whereIn('tasks.workspace_id', Workspace::query()->where('key', mb_strtoupper($reference[1]))->select('id')));
                }
            });
        }
    }

    /**
     * @param  Builder<Task>  $query
     * @param  Criteria  $criteria
     */
    private function filterDue(Builder $query, array $criteria, CarbonImmutable $today): void
    {
        $date = $today->toDateString();

        match ($criteria['due'] ?? null) {
            'overdue' => $query->open()->where('tasks.due_date', '<', $date),
            'today' => $query->where('tasks.due_date', $date),
            'week' => $query->whereBetween('tasks.due_date', [$date, LanePlacement::weekEnd($today)->toDateString()]),
            'none' => $query->whereNull('tasks.due_date'),
            default => null,
        };

        if (($criteria['due_from'] ?? null) !== null) {
            $query->where('tasks.due_date', '>=', $criteria['due_from']);
        }

        if (($criteria['due_to'] ?? null) !== null) {
            $query->where('tasks.due_date', '<=', $criteria['due_to']);
        }
    }

    /**
     * @param  Builder<Task>  $query
     */
    private function sort(Builder $query, string $sort, bool $descending): void
    {
        $direction = $descending ? 'desc' : 'asc';

        match ($sort) {
            'priority' => $query
                ->orderByRaw("case when tasks.priority = 0 then 5 else tasks.priority end {$direction}")
                ->orderByRaw('tasks.due_date asc nulls last'),
            'created' => $query->orderBy('tasks.created_at', $direction),
            'updated' => $query->orderBy('tasks.updated_at', $direction),
            'title' => $query->orderByRaw("lower(tasks.title) {$direction}"),
            'workspace' => $query
                ->orderBy(Workspace::query()->select('name')->whereColumn('workspaces.id', 'tasks.workspace_id')->limit(1), $direction)
                ->orderByRaw('tasks.due_date asc nulls last'),
            default => $query
                ->orderByRaw("tasks.due_date {$direction} nulls last")
                ->orderBy('tasks.priority'),
        };

        $query->orderBy('tasks.number')->orderBy('tasks.id');
    }
}
