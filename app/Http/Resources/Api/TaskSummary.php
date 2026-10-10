<?php

namespace App\Http\Resources\Api;

use App\Models\Task;
use App\Models\User;

/**
 * Compact task for the mobile app (Tahap 1): the fields the list, "tugas
 * hari ini" and the quick status change need — id, key, judul, workspace,
 * status, prioritas, jatuh tempo, penerima, sumber. Eager-load `workspace`,
 * `status` and `assignees` (same shape as TugasHariIni's items).
 */
final class TaskSummary
{
    /**
     * @return array<string, mixed>
     */
    public static function make(Task $task): array
    {
        return [
            'id' => $task->id,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'workspace' => [
                'key' => $task->workspace->key,
                'name' => $task->workspace->name,
            ],
            'status' => [
                'id' => $task->status->id,
                'name' => $task->status->name,
                'category' => $task->status->category->value,
                'is_done' => $task->isClosed(),
            ],
            'priority' => [
                'value' => $task->priority->value,
                'label' => $task->priority->label(),
            ],
            'due_date' => $task->due_date?->toDateString(),
            'assignees' => $task->assignees->map(fn (User $user): string => $user->name)->values()->all(),
            'source' => $task->source->value,
        ];
    }

    /**
     * The summary plus a few detail fields (GET /tugas/{task}). Needs the
     * checklist counts (withCount) when they were loaded.
     *
     * @return array<string, mixed>
     */
    public static function detail(Task $task): array
    {
        $attributes = $task->getAttributes();
        $total = (int) ($attributes['checklist_items_count'] ?? 0);

        return [
            ...self::make($task),
            'description_text' => $task->description_text,
            'start_date' => $task->start_date?->toDateString(),
            'checklist' => $total > 0 ? ['done' => (int) ($attributes['checklist_done_count'] ?? 0), 'total' => $total] : null,
            'url' => $task->url(),
            'created_at' => $task->created_at?->toIso8601String(),
            'completed_at' => $task->completed_at?->toIso8601String(),
        ];
    }
}
