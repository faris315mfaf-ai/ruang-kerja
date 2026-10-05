<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\ActivityEvent;
use App\Events\Tasks\TaskDeleted;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deletes a task (its number is never reused).
 */
final class DeleteTask
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    public function handle(Task $task, User $actor): void
    {
        DB::transaction(function () use ($task, $actor): void {
            $task->loadMissing('workspace');

            $this->recordActivity->handle($task->workspace, $task, $actor, ActivityEvent::TaskDeleted, [
                'key' => $task->displayKey(),
                'title' => $task->title,
            ]);

            $task->delete();
        });

        TaskDeleted::dispatch($task);
    }
}
