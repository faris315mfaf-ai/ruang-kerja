<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Okr\Services\LinkableTasks;
use App\Models\KeyResult;
use App\Models\Task;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Links a task to a key result so its output shows next to the result. Only
 * tasks the user can see in a workspace of the objective's division
 * (LinkableTasks); linking twice is a no-op.
 */
final class LinkTaskToKeyResult
{
    public function __construct(private readonly LinkableTasks $linkable) {}

    public function handle(KeyResult $keyResult, Task $task, User $user): void
    {
        if (! $this->linkable->query($keyResult, $user)->whereKey($task->id)->exists()) {
            throw ValidationException::withMessages([
                'task_id' => 'Tugas ini tidak ada di workspace divisi objective atau tidak bisa Anda lihat.',
            ]);
        }

        $keyResult->tasks()->syncWithoutDetaching([
            $task->id => ['linked_by' => $user->id, 'created_at' => now()],
        ]);
    }
}
