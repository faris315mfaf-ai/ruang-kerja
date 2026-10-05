<?php

namespace App\Policies;

use App\Models\GoogleAccount;
use App\Models\User;

/**
 * Every employee may connect their own Google account; nobody can see or
 * remove someone else's connection (tokens are personal).
 */
class GoogleAccountPolicy
{
    public function connect(User $user): bool
    {
        return true;
    }

    /**
     * Request a short-lived access token for Google Picker.
     */
    public function usePicker(User $user): bool
    {
        return true;
    }

    public function view(User $user, GoogleAccount $account): bool
    {
        return $account->user_id === $user->id;
    }

    public function delete(User $user, GoogleAccount $account): bool
    {
        return $account->user_id === $user->id;
    }
}
