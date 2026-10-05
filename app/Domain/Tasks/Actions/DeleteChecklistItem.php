<?php

namespace App\Domain\Tasks\Actions;

use App\Events\Tasks\TaskUpdated;
use App\Models\ChecklistItem;
use App\Models\Task;

/**
 * Removes a checklist line.
 */
final class DeleteChecklistItem
{
    public function handle(ChecklistItem $item): void
    {
        /** @var Task $task */
        $task = $item->task()->firstOrFail();

        $item->delete();
        $task->touch();
        TaskUpdated::dispatch($task);
    }
}
