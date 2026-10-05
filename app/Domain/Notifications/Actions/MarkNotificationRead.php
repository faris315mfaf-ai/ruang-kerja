<?php

namespace App\Domain\Notifications\Actions;

use App\Models\InboxNotification;

final class MarkNotificationRead
{
    public function handle(InboxNotification $notification): void
    {
        if ($notification->read_at === null) {
            $notification->forceFill(['read_at' => now()])->save();
        }
    }
}
