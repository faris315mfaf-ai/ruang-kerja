<?php

namespace App\Domain\Notifications\Actions;

use App\Models\InboxNotification;

/**
 * Archiving also marks the notification as read (it leaves the unread count).
 */
final class ArchiveNotification
{
    public function handle(InboxNotification $notification): void
    {
        if ($notification->archived_at !== null) {
            return;
        }

        $now = now();

        $notification->forceFill([
            'archived_at' => $now,
            'read_at' => $notification->read_at ?? $now,
        ])->save();
    }
}
