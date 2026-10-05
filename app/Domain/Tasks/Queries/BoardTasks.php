<?php

namespace App\Domain\Tasks\Queries;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Tasks of one workspace for the board, list and calendar views: every open
 * task, closed tasks of the last CLOSED_DAYS days, and — for the calendar —
 * every task due inside the visible grid.
 */
final class BoardTasks
{
    public const int CLOSED_DAYS = 30;

    /**
     * @return Builder<Task>
     */
    public static function query(): Builder
    {
        return Task::query()
            ->with(['workspace:id,key', 'assignees:id', 'labels:id', 'parent:id,number'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ]);
    }

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}|null  $dueRange
     * @return Collection<int, Task>
     */
    public function for(Workspace $workspace, ?array $dueRange = null): Collection
    {
        $since = now()->subDays(self::CLOSED_DAYS);

        return self::query()
            ->where('workspace_id', $workspace->id)
            ->where(function (Builder $query) use ($since, $dueRange): void {
                $query->whereNotIn('status_category', TaskStatusCategory::closedValues())
                    ->orWhere('completed_at', '>=', $since)
                    ->orWhere('canceled_at', '>=', $since);

                if ($dueRange !== null) {
                    $query->orWhereBetween('due_date', [$dueRange[0]->toDateString(), $dueRange[1]->toDateString()]);
                }
            })
            ->orderBy('position')
            ->orderBy('number')
            ->get();
    }

    /**
     * Closed tasks hidden by the 30-day window (shown as a hint under the board).
     */
    public function hiddenClosedCount(Workspace $workspace): int
    {
        $since = now()->subDays(self::CLOSED_DAYS);

        return Task::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('status_category', TaskStatusCategory::closedValues())
            ->where(fn (Builder $query) => $query
                ->whereNull('completed_at')->whereNull('canceled_at')
                ->orWhere('completed_at', '<', $since)
                ->orWhere('canceled_at', '<', $since))
            ->count();
    }
}
