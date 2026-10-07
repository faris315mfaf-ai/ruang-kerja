<?php

namespace App\Listeners\Automation;

use App\Domain\Automation\Enums\RuleTriggerType;
use App\Domain\Automation\Jobs\RunTaskAutomations;
use App\Domain\Automation\Services\AutomationContext;
use App\Domain\Automation\Services\TaskCategoryChanges;
use App\Events\Tasks\TaskCreated;
use App\Events\Tasks\TaskMoved;
use App\Models\AutomationRule;
use App\Models\Task;

/**
 * Starts the automation rules of a task's workspace (F2-4):
 *
 * - TaskMoved → "pindah ke kolom kategori X" when the move changed the
 *   category (TaskCategoryChanges; reorders inside a column do not count);
 * - TaskCreated → "dibuat berlabel".
 *
 * Only checks that a matching active rule exists (one indexed query) and
 * queues RunTaskAutomations with the current chain depth, so the request
 * that moved or created the task never waits for the rules. Both events are
 * dispatched after commit.
 */
final class TriggerTaskAutomations
{
    public function __construct(
        private readonly TaskCategoryChanges $changes,
        private readonly AutomationContext $context,
    ) {}

    public function handleTaskMoved(TaskMoved $event): void
    {
        $change = $this->changes->pull($event->task);

        if ($change === null || ! (bool) config('features.automation')) {
            return;
        }

        $this->queue($event->task, RuleTriggerType::TaskMoved, $change['to']->value);
    }

    public function handleTaskCreated(TaskCreated $event): void
    {
        if (! (bool) config('features.automation')) {
            return;
        }

        $this->queue($event->task, RuleTriggerType::TaskCreatedWithLabel, null);
    }

    private function queue(Task $task, RuleTriggerType $trigger, ?string $category): void
    {
        $exists = AutomationRule::query()
            ->where('workspace_id', $task->workspace_id)
            ->where('trigger_type', $trigger->value)
            ->where('is_active', true)
            ->when($category !== null, fn ($query) => $query->whereRaw("automation_rules.trigger->>'category' = ?", [$category]))
            ->exists();

        if ($exists) {
            RunTaskAutomations::dispatch($task->id, $trigger, $category, $this->context->depth(), $this->context->chain());
        }
    }
}
