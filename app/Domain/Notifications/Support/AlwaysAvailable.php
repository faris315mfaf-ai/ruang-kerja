<?php

namespace App\Domain\Notifications\Support;

use App\Domain\Notifications\Contracts\UserAvailability;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Default until the Requests module knows about approved leave.
 */
final class AlwaysAvailable implements UserAvailability
{
    public function isOnLeave(User $user, CarbonInterface $at): bool
    {
        return false;
    }
}
