<?php

namespace App\Events\Tasks;

final class CommentUpdated extends CommentBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'comment.updated';
    }
}
