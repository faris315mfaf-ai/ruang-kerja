<?php

namespace App\Http\Resources;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Task for board/list/calendar (resources/js/features/tasks/types.ts `Task`).
 * Eager-load `workspace:id,key`, `assignees:id`, `labels:id`, `parent:id,number`
 * and the checklist counts (see BoardTasks::query()) to avoid N+1 queries.
 *
 * @mixin Task
 */
class TaskResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Task $task */
        $task = $this->resource;
        // Counts come from BoardTasks::query() (withCount); other callers may not load them.
        $attributes = $task->getAttributes();
        $total = (int) ($attributes['checklist_items_count'] ?? 0);
        $parent = $task->relationLoaded('parent') ? $task->parent : null;

        return [
            'id' => $task->id,
            'workspace_id' => $task->workspace_id,
            'number' => $task->number,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'description_text' => $task->description_text,
            'status_id' => $task->status_id,
            'status_category' => $task->status_category->value,
            'priority' => $task->priority->value,
            'position' => $task->position,
            'start_date' => $task->start_date?->toDateString(),
            'due_date' => $task->due_date?->toDateString(),
            'estimate_hours' => $task->estimate_hours === null ? null : (float) $task->estimate_hours,
            'parent_id' => $task->parent_id,
            'parent_key' => $parent !== null ? $task->workspace->key.'-'.$parent->number : null,
            'assignee_ids' => $task->relationLoaded('assignees') ? $task->assignees->pluck('id')->values()->all() : [],
            'label_ids' => $task->relationLoaded('labels') ? $task->labels->pluck('id')->values()->all() : [],
            'checklist' => $total > 0 ? ['done' => (int) ($attributes['checklist_done_count'] ?? 0), 'total' => $total] : null,
            'created_by' => $task->created_by,
            'created_at' => $task->created_at?->toIso8601String(),
            'completed_at' => $task->completed_at?->toIso8601String(),
        ];
    }
}
