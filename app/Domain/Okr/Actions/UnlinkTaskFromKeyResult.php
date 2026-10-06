<?php

namespace App\Domain\Okr\Actions;

use App\Models\KeyResult;

/**
 * Removes the link between a key result and a task (the task stays).
 */
final class UnlinkTaskFromKeyResult
{
    public function handle(KeyResult $keyResult, string $taskId): bool
    {
        return $keyResult->tasks()->detach($taskId) > 0;
    }
}
