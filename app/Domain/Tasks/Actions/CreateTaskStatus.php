<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\TaskStatus;
use App\Models\Workspace;

/**
 * Adds a board column at the end.
 */
final class CreateTaskStatus
{
    public function handle(Workspace $workspace, string $name, TaskStatusCategory $category, ?string $color = null): TaskStatus
    {
        $last = TaskStatus::query()
            ->where('workspace_id', $workspace->id)
            ->orderByDesc('position')
            ->value('position');

        return TaskStatus::query()->create([
            'workspace_id' => $workspace->id,
            'name' => $name,
            'category' => $category,
            'color' => $color ?? $category->defaultColor(),
            'position' => Lexorank::between(is_string($last) ? $last : null, null),
        ]);
    }
}
