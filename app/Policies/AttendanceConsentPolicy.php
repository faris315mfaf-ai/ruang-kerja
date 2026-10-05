<?php

namespace App\Policies;

use App\Models\User;

/**
 * Employees give or withdraw their own consent; nobody else can.
 */
class AttendanceConsentPolicy
{
    public function create(User $actor): bool
    {
        return $actor->isActive();
    }

    public function revoke(User $actor): bool
    {
        return $actor->isActive();
    }
}
