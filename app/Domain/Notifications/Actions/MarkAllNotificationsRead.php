<?php

namespace App\Domain\Notifications\Actions;

use App\Models\InboxNotification;
use App\Models\User;

/**
 * "Tandai semua dibaca": every unread, non-archived notification of the user.
 */
final class MarkAllNotificationsRead
{
    /**
     * @return int number of notifications marked as read
     */
    public function handle(User $user): int
    {
        return InboxNotification::query()
            ->visibleTo($user)
            ->active()
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);
    }
}
