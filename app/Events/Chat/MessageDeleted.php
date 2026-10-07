<?php

namespace App\Events\Chat;

final class MessageDeleted extends ChatBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'message.deleted';
    }
}
