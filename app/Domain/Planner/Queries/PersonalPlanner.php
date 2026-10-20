<?php

namespace App\Domain\Planner\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Planner\Services\CompletionTarget;
use App\Domain\Planner\Services\LanePlacement;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\Gate;

/**
 * "Ruang saya" on Beranda: the viewer's own plan over the tasks assigned to
 * them (any workspace they can see) and the tasks of their personal
 * workspace. Read-only; a fixed number of queries whatever the task count.
 *
 * - `incoming`: open tasks someone else assigned in the last INCOMING_DAYS
 *   that the viewer has not accepted yet (no plan row / seen_at null).
 *   Older unaccepted assignments are placed automatically instead, so the
 *   box never floods with history.
 * - `lanes`: today / week / later from task_plans.bucket, else automatic by
 *   due date (LanePlacement, `auto: true`, nothing written). Planned items
 *   first (lexorank), then automatic ones (overdue, nearest due, priority).
 *   A "today" plan set on an earlier day stays in today (`carried: true`).
 *   Tasks completed today stay in their lane at the bottom (`done: true`).
 */
final class PersonalPlanner
{
    public const int INCOMING_DAYS = 14;

    /**
     * @return array{
     *     today: string,
     *     incoming: list<array<string, mixed>>,
     *     lanes: array<string, list<array<string, mixed>>>,
     *     counts: array<string, int>,
     *     progress: array{done: int, total: int}
     * }
     */
    public function for(User $viewer, CarbonImmutable $now): array
    {
        $today = Period::officeDate($now);
        $incomingSince = $now->subDays(self::INCOMING_DAYS);
        $incoming = [];
        /** @var array<string, list<array{sort: array<int, int|string>, item: array<string, mixed>}>> $open */
        $open = array_fill_keys(PlanBucket::values(), []);
        /** @var array<string, list<array{sort: string, item: array<string, mixed>}>> $done */
        $done = array_fill_keys(PlanBucket::values(), []);

        foreach ($this->candidates($viewer, $today)->get() as $task) {
            $row = $task->getAttributes();
            $bucket = is_string($row['plan_bucket'] ?? null) ? PlanBucket::from($row['plan_bucket']) : null;

            if ($this->isIncoming($task, $viewer, $row, $incomingSince)) {
                $incoming[] = ['sort' => (string) $row['assigned_at'], 'item' => $this->incomingItem($task, $row, $today)];

                continue;
            }

            $lane = $bucket ?? LanePlacement::auto($task->due_date, $today);
            $carried = $bucket === PlanBucket::Today
                && is_string($row['plan_planned_for'] ?? null)
                && $row['plan_planned_for'] < $today->toDateString();
            $item = $this->item($task, $viewer, $today, $lane, $bucket === null, $carried && ! $task->isClosed());

            if ($task->status_category === TaskStatusCategory::Done) {
                $done[$lane->value][] = ['sort' => (string) $task->completed_at?->toIso8601String(), 'item' => $item];

                continue;
            }

            $open[$lane->value][] = [
                'sort' => $bucket !== null
                    // Planned first, in the user's own order.
                    ? [0, (string) $row['plan_position'], $task->number]
                    // Then automatic: overdue / nearest due first, undated last, then priority, oldest first.
                    : [1, $task->due_date?->toDateString() ?? '9999-12-31', $task->priority->value === 0 ? 9 : $task->priority->value, (string) $task->created_at?->toIso8601String(), $task->number],
                'item' => $item,
            ];
        }

        usort($incoming, fn (array $a, array $b): int => strcmp($b['sort'], $a['sort']));
        $lanes = [];
        $counts = ['incoming' => count($incoming)];

        foreach (PlanBucket::values() as $lane) {
            usort($open[$lane], fn (array $a, array $b): int => self::compare($a['sort'], $b['sort']));
            usort($done[$lane], fn (array $a, array $b): int => strcmp($a['sort'], $b['sort']));
            $lanes[$lane] = [...array_column($open[$lane], 'item'), ...array_column($done[$lane], 'item')];
            $counts[$lane] = count($open[$lane]);
        }

        $doneToday = count($done[PlanBucket::Today->value]);

        return [
            'today' => $today->toDateString(),
            'incoming' => array_column($incoming, 'item'),
            'lanes' => $lanes,
            'counts' => $counts,
            'progress' => ['done' => $doneToday, 'total' => $doneToday + $counts[PlanBucket::Today->value]],
        ];
    }

    /**
     * Open tasks plus tasks completed today, assigned to the viewer or in
     * their personal workspace, in visible non-archived workspaces — with the
     * viewer's plan row and assignment (assigner name) joined in.
     *
     * @return Builder<Task>
     */
    private function candidates(User $viewer, CarbonImmutable $today): Builder
    {
        $personal = Workspace::query()
            ->where('type', WorkspaceType::Personal->value)
            ->where('owner_id', $viewer->id)
            ->select('id');

        return Task::query()
            ->select('tasks.*')
            ->addSelect([
                'task_plans.id as plan_id',
                'task_plans.bucket as plan_bucket',
                'task_plans.position as plan_position',
                'task_plans.planned_for as plan_planned_for',
                'task_plans.seen_at as plan_seen_at',
                'mine.assigned_at as assigned_at',
                'mine.assigned_by as assigned_by',
                'assigner.name as assigner_name',
            ])
            ->leftJoin('task_plans', fn (JoinClause $join) => $join
                ->on('task_plans.task_id', '=', 'tasks.id')
                ->where('task_plans.user_id', '=', $viewer->id))
            ->leftJoin('task_assignees as mine', fn (JoinClause $join) => $join
                ->on('mine.task_id', '=', 'tasks.id')
                ->where('mine.user_id', '=', $viewer->id))
            ->leftJoin('users as assigner', 'assigner.id', '=', 'mine.assigned_by')
            ->whereIn('tasks.workspace_id', Workspace::query()->visibleTo($viewer)->notArchived()->select('id'))
            ->respectingPrivacyOf($viewer)
            ->where(fn (Builder $query) => $query
                ->whereNotNull('mine.user_id')
                ->orWhereIn('tasks.workspace_id', $personal))
            ->where(fn (Builder $query) => $query
                ->whereNotIn('tasks.status_category', TaskStatusCategory::closedValues())
                ->orWhere(fn (Builder $done) => $done
                    ->where('tasks.status_category', TaskStatusCategory::Done->value)
                    ->where('tasks.completed_at', '>=', $today->utc()->toIso8601String())))
            ->with([
                'workspace',
                // The viewer's membership row: the move() check needs no extra query.
                'workspace.membership' => fn (Relation $membership) => $membership->where('user_id', $viewer->id),
                // Only what CompletionTarget needs: the Review and Done columns.
                'workspace.statuses' => fn (Relation $statuses) => $statuses->whereIn('category', [TaskStatusCategory::Review->value, TaskStatusCategory::Done->value]),
                'status:id,workspace_id,name,category',
            ])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ]);
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function isIncoming(Task $task, User $viewer, array $row, CarbonImmutable $since): bool
    {
        $assignedBy = $row['assigned_by'] ?? null;
        $assignedAt = $row['assigned_at'] ?? null;

        return ! $task->isClosed()
            && ! $task->workspace->isPersonal()
            && is_string($assignedBy) && $assignedBy !== $viewer->id
            && ($row['plan_seen_at'] ?? null) === null
            && is_string($assignedAt) && CarbonImmutable::parse($assignedAt)->greaterThanOrEqualTo($since);
    }

    /**
     * @return array<string, mixed>
     */
    private function item(Task $task, User $viewer, CarbonImmutable $today, PlanBucket $lane, bool $auto, bool $carried): array
    {
        $workspace = $task->workspace;
        $target = CompletionTarget::resolve($task, $workspace, $workspace->statuses);
        $access = Gate::forUser($viewer)->inspect('move', $task);
        $canComplete = $target !== null && $access->allowed();

        return [
            ...$this->base($task, $today),
            'status' => ['id' => $task->status->id, 'name' => $task->status->name, 'category' => $task->status_category->value],
            'is_personal' => $workspace->isPersonal(),
            'checklist' => self::checklist($task),
            'lane' => $lane->value,
            'auto' => $auto,
            'carried' => $carried,
            'done' => $task->status_category === TaskStatusCategory::Done,
            'completed_at' => $task->completed_at?->toIso8601String(),
            'can_complete' => $canComplete,
            'completes_to' => $canComplete ? $target['outcome'] : null,
            'complete_hint' => match (true) {
                $canComplete || $task->isClosed() => null,
                $target === null => 'Workspace ini belum punya kolom Selesai.',
                default => 'Anda hanya bisa melihat tugas ini. Minta admin workspace mengubah statusnya.',
            },
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function incomingItem(Task $task, array $row, CarbonImmutable $today): array
    {
        return [
            ...$this->base($task, $today),
            'assigned_by' => is_string($row['assigner_name'] ?? null) ? $row['assigner_name'] : null,
            'assigned_at' => CarbonImmutable::parse((string) $row['assigned_at'])->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function base(Task $task, CarbonImmutable $today): array
    {
        $workspace = $task->workspace;
        $due = $task->due_date?->toDateString();

        return [
            'id' => $task->id,
            'key' => $workspace->key.'-'.$task->number,
            'number' => $task->number,
            'title' => $task->title,
            'url' => $task->url(),
            'workspace' => ['name' => $workspace->name, 'key' => $workspace->key, 'type' => $workspace->type->value],
            'due_date' => $due,
            'days_late' => $due !== null && ! $task->isClosed() && $due < $today->toDateString()
                ? (int) round(CarbonImmutable::parse($due, 'UTC')->diffInDays(CarbonImmutable::parse($today->toDateString(), 'UTC')))
                : 0,
            'priority' => $task->priority->value,
        ];
    }

    /**
     * @return array{done: int, total: int}|null
     */
    private static function checklist(Task $task): ?array
    {
        $attributes = $task->getAttributes();
        $total = (int) ($attributes['checklist_items_count'] ?? 0);

        return $total > 0 ? ['done' => (int) ($attributes['checklist_done_count'] ?? 0), 'total' => $total] : null;
    }

    /**
     * @param  array<int, int|string>  $a
     * @param  array<int, int|string>  $b
     */
    private static function compare(array $a, array $b): int
    {
        foreach ($a as $index => $value) {
            $other = $b[$index] ?? null;
            $result = is_int($value) && is_int($other) ? $value <=> $other : strcmp((string) $value, (string) $other);

            if ($result !== 0) {
                return $result;
            }
        }

        return 0;
    }
}
