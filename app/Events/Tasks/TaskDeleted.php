<?php

namespace App\Events\Tasks;

final class TaskDeleted extends TaskBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'task.deleted';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['task' => ['id' => $this->task->id, 'workspace_id' => $this->task->workspace_id]];
    }
}
