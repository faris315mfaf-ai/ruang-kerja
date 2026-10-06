<?php

namespace App\Domain\Automation\Services;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;

/**
 * Remembers, per task, the column category a task left when it was saved in
 * another category (Eloquent `updated`, registered in
 * AutomationServiceProvider). TaskMoved carries only the task: it is also
 * fired for reorders inside a column, and UpdateTask saves the same model
 * again before the event is dispatched after commit, so wasChanged() cannot
 * tell. The listener consumes the entry when TaskMoved arrives. Scoped
 * singleton: never outlives the request / queued job.
 */
final class TaskCategoryChanges
{
    /** @var array<string, array{from: TaskStatusCategory, to: TaskStatusCategory}> */
    private array $changes = [];

    public function record(Task $task): void
    {
        if (! $task->wasChanged('status_category')) {
            return;
        }

        $from = $task->getOriginal('status_category');
        $from = $from instanceof TaskStatusCategory ? $from : TaskStatusCategory::tryFrom((string) $from);

        if ($from === null || $from === $task->status_category) {
            return;
        }

        // Keep the first origin when a task moves twice before the event (A → B → C = A → C).
        $this->changes[$task->id] = [
            'from' => $this->changes[$task->id]['from'] ?? $from,
            'to' => $task->status_category,
        ];
    }

    /**
     * The pending change of $task, removed from the list.
     *
     * @return array{from: TaskStatusCategory, to: TaskStatusCategory}|null
     */
    public function pull(Task $task): ?array
    {
        $change = $this->changes[$task->id] ?? null;
        unset($this->changes[$task->id]);

        if ($change === null || $change['from'] === $change['to']) {
            return null;
        }

        return $change;
    }
}
