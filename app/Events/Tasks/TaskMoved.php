<?php

namespace App\Events\Tasks;

final class TaskMoved extends TaskBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'task.moved';
    }
}
