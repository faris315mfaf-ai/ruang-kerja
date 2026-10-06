<?php

namespace App\Events\Chat;

final class ChannelRead extends ChatBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'read.updated';
    }
}
