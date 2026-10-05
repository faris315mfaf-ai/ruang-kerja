<?php

namespace App\Events\Tasks;

final class CommentPosted extends CommentBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'comment.posted';
    }
}
