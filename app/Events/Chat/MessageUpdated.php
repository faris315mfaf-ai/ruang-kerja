<?php

namespace App\Events\Chat;

final class MessageUpdated extends ChatBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'message.updated';
    }
}
