<?php

namespace App\Events\Chat;

final class MessagePosted extends ChatBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'message.posted';
    }
}
