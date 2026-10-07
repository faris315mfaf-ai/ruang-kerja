<?php

namespace App\Domain\Reports\Queries;

use App\Domain\Reports\Support\ReportDay;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Arrays of daily reports for the pages (resources/js/features/reports/types.ts).
 * Task titles are shown only to readers who can see the task; others get the
 * task key copied at report time (docs/DATABASE.md §4 daily_reports).
 */
final class ReportPresenter
{
    /**
     * Ids among $taskIds that $viewer can see (one query).
     *
     * @param  iterable<string|null>  $taskIds
     * @return array<string, true>
     */
    public static function visibleTaskIds(User $viewer, iterable $taskIds): array
    {
        $ids = collect($taskIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $visible = [];

        foreach (Task::query()->visibleTo($viewer)->whereKey($ids->all())->pluck('id') as $id) {
            $visible[(string) $id] = true;
        }

        return $visible;
    }

    /**
     * @param  array<string, true>  $visible  task ids the viewer can see
     * @return array<string, mixed>
     */
    public static function item(DailyReportItem $item, array $visible): array
    {
        $canSee = $item->task_id !== null && isset($visible[$item->task_id]);

        return [
            'id' => $item->id,
            'task_id' => $canSee ? $item->task_id : null,
            'task_key' => $item->task_key,
            // Title only for readers who may see the task; null = other work or hidden.
            'task_title' => $canSee ? $item->task_title : null,
            'is_task' => $item->task_key !== null,
            'progress_note' => $item->progress_note,
            'percent' => $item->percent,
            'hours' => $item->hours === null ? null : (float) $item->hours,
            'move_status_id' => $canSee ? $item->move_status_id : null,
            'status_category_after' => $item->status_category_after?->value,
        ];
    }

    /**
     * @param  array<string, true>  $visible
     * @return array<string, mixed>
     */
    public static function report(DailyReport $report, array $visible, ?string $today = null): array
    {
        $today ??= ReportDay::today();
        $items = $report->items;
        $hours = $items->sum(fn (DailyReportItem $item): float => (float) ($item->hours ?? 0));

        return [
            'id' => $report->id,
            'date' => $report->report_date->toDateString(),
            'status' => $report->isSubmitted() ? 'submitted' : 'draft',
            'submitted_at' => $report->submitted_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
            'editable' => $report->report_date->toDateString() === $today,
            'summary' => $report->summary,
            'blockers' => $report->blockers,
            'notes' => $report->notes,
            'items_count' => $items->count(),
            'hours' => $hours > 0 ? round($hours, 2) : null,
            'items' => array_values($items->map(fn (DailyReportItem $item): array => self::item($item, $visible))->all()),
        ];
    }

    /**
     * @return array{id: string, name: string, avatar: string|null, position: string|null, division: string|null}
     */
    public static function person(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar' => $user->avatar_url,
            'position' => $user->relationLoaded('position') ? $user->position?->name : null,
            'division' => $user->relationLoaded('division') ? $user->division?->name : null,
        ];
    }

    /**
     * Task ids of many reports.
     *
     * @param  iterable<DailyReport>  $reports
     * @return Collection<int, string|null>
     */
    public static function taskIdsOf(iterable $reports): Collection
    {
        return collect($reports)->flatMap(fn (DailyReport $report) => $report->items->pluck('task_id'));
    }
}
