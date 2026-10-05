<?php

namespace App\Events\Tasks;

final class CommentDeleted extends CommentBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'comment.deleted';
    }
}
