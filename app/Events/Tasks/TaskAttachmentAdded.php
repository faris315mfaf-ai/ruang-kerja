<?php

namespace App\Events\Tasks;

final class TaskAttachmentAdded extends TaskAttachmentBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'attachment.added';
    }
}
