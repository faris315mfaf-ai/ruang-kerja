<?php

namespace App\Policies;

use App\Models\NotificationPreference;
use App\Models\User;

/**
 * Notification preferences are personal: only the owner may change them.
 */
class NotificationPreferencePolicy
{
    /**
     * Change any (event, channel) cell of $owner (rows may not exist yet).
     */
    public function manage(User $actor, User $owner): bool
    {
        return $actor->is($owner);
    }

    public function update(User $actor, NotificationPreference $preference): bool
    {
        return $preference->user_id === $actor->id;
    }
}
