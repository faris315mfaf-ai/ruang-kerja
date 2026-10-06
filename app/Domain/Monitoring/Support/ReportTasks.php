<?php

namespace App\Domain\Monitoring\Support;

use App\Models\DailyReportItem;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;

/**
 * Which tasks of daily report items a reader may see (docs/DATABASE.md
 * daily_reports: the title and link only when the reader can see the task —
 * otherwise the copied `task_key` alone, so a personal to-do never leaks).
 * One query for any number of items.
 */
final class ReportTasks
{
    /** @var array<string, array{title: string, url: string, workspace: string, workspace_id: string, project: bool}> */
    private array $visible = [];

    /**
     * @param  iterable<string|null>  $taskIds
     */
    public static function for(User $viewer, iterable $taskIds): self
    {
        $ids = [];

        foreach ($taskIds as $id) {
            if (is_string($id)) {
                $ids[$id] = true;
            }
        }

        $self = new self;

        if ($ids === []) {
            return $self;
        }

        $tasks = Task::query()
            ->whereIn('tasks.id', array_keys($ids))
            ->whereIn('tasks.workspace_id', Workspace::query()->visibleTo($viewer)->select('workspaces.id'))
            ->with('workspace:id,key,name,type')
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title']);

        foreach ($tasks as $task) {
            $self->visible[$task->id] = [
                'title' => $task->title,
                'url' => '/w/'.$task->workspace->key.'/tasks/'.$task->number,
                'workspace' => $task->workspace->name,
                'workspace_id' => $task->workspace_id,
                'project' => $task->workspace->isProject(),
            ];
        }

        return $self;
    }

    /**
     * An item as the reader may see it.
     *
     * @return array{id: string, task_id: string|null, key: string|null, title: string|null, url: string|null, workspace: string|null, progress_note: string, percent: int|null, hours: float|null, status_category_after: string|null}
     */
    public function item(DailyReportItem $item): array
    {
        $task = $item->task_id !== null ? ($this->visible[$item->task_id] ?? null) : null;

        return [
            'id' => $item->id,
            'task_id' => $task !== null ? $item->task_id : null,
            'key' => $item->task_key,
            // The copy is shown only to readers who may see the task itself.
            'title' => $task['title'] ?? null,
            'url' => $task['url'] ?? null,
            'workspace' => $task['workspace'] ?? null,
            'progress_note' => $item->progress_note,
            'percent' => $item->percent,
            'hours' => $item->hours !== null ? (float) $item->hours : null,
            'status_category_after' => $item->status_category_after?->value,
        ];
    }

    public function sees(?string $taskId): bool
    {
        return $taskId !== null && isset($this->visible[$taskId]);
    }

    /**
     * @return array{title: string, url: string, workspace: string, workspace_id: string, project: bool}|null
     */
    public function task(?string $taskId): ?array
    {
        return $taskId !== null ? ($this->visible[$taskId] ?? null) : null;
    }
}
