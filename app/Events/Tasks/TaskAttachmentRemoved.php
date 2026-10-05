<?php

namespace App\Events\Tasks;

final class TaskAttachmentRemoved extends TaskAttachmentBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'attachment.removed';
    }
}
