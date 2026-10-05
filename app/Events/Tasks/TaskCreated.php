<?php

namespace App\Events\Tasks;

final class TaskCreated extends TaskBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'task.created';
    }
}
