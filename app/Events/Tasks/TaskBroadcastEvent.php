<?php

namespace App\Events\Tasks;

use App\Domain\Tasks\Queries\BoardTasks;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Base of the task events broadcast on the private channel `workspace.{id}`
 * (authorized in routes/channels.php with WorkspacePolicy::view). Sprint 6
 * subscribes to them in the board/list/sheet; dispatched after commit.
 */
abstract class TaskBroadcastEvent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Task $task) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('workspace.'.$this->task->workspace_id)];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        // Fresh board shape (relations + checklist counts), as sent by PATCH /tugas/{id}/move.
        $task = BoardTasks::query()->withTrashed()->find($this->task->id) ?? $this->task->loadMissing('workspace');

        return ['task' => (new TaskResource($task))->resolve()];
    }
}
