<?php

namespace App\Domain\Tasks\Services;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\TaskStatus;
use App\Models\Workspace;

/**
 * The five columns every new workspace starts with (docs/DATABASE.md §4).
 */
final class DefaultTaskStatuses
{
    /**
     * @var list<TaskStatusCategory>
     */
    public const array CATEGORIES = [
        TaskStatusCategory::Backlog,
        TaskStatusCategory::Todo,
        TaskStatusCategory::InProgress,
        TaskStatusCategory::Review,
        TaskStatusCategory::Done,
    ];

    /**
     * Creates the default columns when the workspace has none yet (idempotent).
     */
    public function ensure(Workspace $workspace): void
    {
        if ($workspace->statuses()->exists()) {
            return;
        }

        $positions = Lexorank::sequence(count(self::CATEGORIES));

        foreach (self::CATEGORIES as $index => $category) {
            TaskStatus::query()->create([
                'workspace_id' => $workspace->id,
                'name' => $category->label(),
                'category' => $category,
                'color' => $category->defaultColor(),
                'position' => $positions[$index],
            ]);
        }
    }
}
