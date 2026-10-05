<?php

namespace Tests\Fixtures\Google;

use App\Models\User;

/**
 * Members can view; everyone except viewers can update.
 */
class FolderOwnerPolicy
{
    public function view(User $user, FolderOwner $owner): bool
    {
        return $owner->roleOf($user->email) !== null;
    }

    public function update(User $user, FolderOwner $owner): bool
    {
        return ! in_array($owner->roleOf($user->email), [null, 'viewer'], true);
    }
}
