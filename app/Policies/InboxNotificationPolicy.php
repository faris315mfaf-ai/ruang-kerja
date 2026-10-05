<?php

namespace App\Policies;

use App\Models\InboxNotification;
use App\Models\User;

/**
 * A notification belongs to its recipient only. No role (not even
 * super_admin) can read or change someone else's Inbox.
 */
class InboxNotificationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, InboxNotification $notification): bool
    {
        return $this->owns($user, $notification);
    }

    /**
     * Mark read/unread, archive/unarchive.
     */
    public function update(User $user, InboxNotification $notification): bool
    {
        return $this->owns($user, $notification);
    }

    private function owns(User $user, InboxNotification $notification): bool
    {
        return $notification->notifiable_type === $user->getMorphClass()
            && $notification->notifiable_id === $user->getKey();
    }
}
