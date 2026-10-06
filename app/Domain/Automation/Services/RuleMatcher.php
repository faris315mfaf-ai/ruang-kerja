<?php

namespace App\Domain\Automation\Services;

use App\Domain\Automation\Enums\RuleTriggerType;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\AutomationRule;
use App\Models\Label;
use App\Models\Task;

/**
 * Whether a rule applies to a task ("Jika …" + optional "Dan …"), and the
 * Indonesian phrase of the trigger used in notifications and the run log.
 */
final class RuleMatcher
{
    /**
     * @param  string|null  $category  the column category the task moved into (task_moved)
     */
    public function triggerMatches(AutomationRule $rule, Task $task, ?string $category = null): bool
    {
        return match ($rule->trigger_type) {
            RuleTriggerType::TaskMoved => $category !== null && ($rule->trigger['category'] ?? null) === $category,
            RuleTriggerType::TaskOverdue => true,
            RuleTriggerType::TaskCreatedWithLabel => is_string($labelId = $rule->trigger['label_id'] ?? null)
                && $task->labels()->whereKey($labelId)->exists(),
        };
    }

    public function conditionHolds(AutomationRule $rule, Task $task): bool
    {
        $condition = $rule->condition;

        if (! is_array($condition)) {
            return true;
        }

        return match ($condition['type'] ?? null) {
            'priority' => (int) ($condition['priority'] ?? -1) === $task->priority->value,
            'assignee' => is_string($userId = $condition['user_id'] ?? null)
                && $task->assignees()->where('users.id', $userId)->exists(),
            default => true,
        };
    }

    /**
     * "pindah ke kolom Review", "lewat tenggat", "dibuat dengan label "Klien"".
     */
    public function reason(AutomationRule $rule): string
    {
        return match ($rule->trigger_type) {
            RuleTriggerType::TaskMoved => 'pindah ke kolom '.(TaskStatusCategory::tryFrom((string) ($rule->trigger['category'] ?? ''))?->label() ?? '…'),
            RuleTriggerType::TaskOverdue => 'lewat tenggat',
            RuleTriggerType::TaskCreatedWithLabel => 'dibuat dengan label "'.(Label::query()->whereKey((string) ($rule->trigger['label_id'] ?? ''))->value('name') ?? '…').'"',
        };
    }
}
