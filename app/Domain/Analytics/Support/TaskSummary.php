<?php

namespace App\Domain\Analytics\Support;

use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Compact task row for dashboard lists (focus, overdue). Eager-load
 * `workspace:id,key,name` and `assignees:id,name,avatar_url`.
 */
final class TaskSummary
{
    /**
     * @return array<string, mixed>
     */
    public static function from(Task $task, CarbonImmutable $today): array
    {
        $key = $task->workspace->key.'-'.$task->number;
        $daysLate = $task->due_date !== null && ! $task->isClosed()
            ? max(0, self::calendarDays($task->due_date->toDateString(), $today->toDateString()))
            : 0;

        return [
            'id' => $task->id,
            'key' => $key,
            'title' => $task->title,
            'url' => '/w/'.$task->workspace->key.'?q='.rawurlencode($key),
            'workspace' => $task->workspace->name,
            'status_category' => $task->status_category->value,
            'priority' => $task->priority->value,
            'due_date' => $task->due_date?->toDateString(),
            'days_late' => $daysLate,
            'checklist' => self::checklist($task),
            'assignees' => $task->relationLoaded('assignees')
                ? $task->assignees->map(fn (User $user): array => ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url])->values()->all()
                : [],
        ];
    }

    /**
     * Whole calendar days from one "Y-m-d" to another (timezone-free).
     */
    private static function calendarDays(string $from, string $to): int
    {
        return (int) round(CarbonImmutable::parse($from, 'UTC')->diffInDays(CarbonImmutable::parse($to, 'UTC')));
    }

    /**
     * From withCount(['checklistItems', 'checklistItems as checklist_done_count' => …]) when loaded
     * (strict models: never read an attribute that was not selected).
     *
     * @return array{done: int, total: int}|null
     */
    private static function checklist(Task $task): ?array
    {
        $attributes = $task->getAttributes();
        $total = (int) ($attributes['checklist_items_count'] ?? 0);

        return $total > 0 ? ['done' => (int) ($attributes['checklist_done_count'] ?? 0), 'total' => $total] : null;
    }
}
