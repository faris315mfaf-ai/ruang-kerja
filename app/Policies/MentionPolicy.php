<?php

namespace App\Policies;

use App\Models\Mention;
use App\Models\User;

/**
 * Mentions are written only by SyncMentions; a user may see the mentions of
 * themselves (Mention::visibleTo) — the content is reached through the
 * comment/task policies.
 */
class MentionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Mention $mention): bool
    {
        return $mention->mentioned_user_id === $user->id;
    }
}
