<?php

namespace App\Events\Tasks;

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
 *
 * Thin payload: channel authorization only happens when subscribing, so a
 * member removed from a private workspace may keep receiving events until
 * they reload. Events therefore carry ids and placement only (no title,
 * description, assignees…); clients refetch the card through the authorized
 * GET /tugas/{id}?view=card, which answers 404 once access is gone.
 */
abstract class TaskBroadcastEvent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Task $task) {}

    /**
     * Dedicated queue with its own Horizon worker (config/horizon.php
     * `supervisor-realtime`): broadcasts never wait behind mail jobs.
     */
    public function broadcastQueue(): string
    {
        return 'realtime';
    }

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
        $task = Task::query()->withTrashed()->find($this->task->id) ?? $this->task;

        return ['task' => [
            'id' => $task->id,
            'workspace_id' => $task->workspace_id,
            'parent_id' => $task->parent_id,
            'status_id' => $task->status_id,
            'status_category' => $task->status_category->value,
            'position' => $task->position,
            'updated_at' => $task->updated_at?->toIso8601String(),
        ]];
    }
}
