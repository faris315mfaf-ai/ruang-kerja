<?php

namespace App\Events\Tasks;

final class TaskUpdated extends TaskBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'task.updated';
    }
}
