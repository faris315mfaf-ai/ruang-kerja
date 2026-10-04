<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * A user may only change their own theme preference.
     */
    public function updateTheme(User $actor, User $target): bool
    {
        return $actor->is($target);
    }
}
