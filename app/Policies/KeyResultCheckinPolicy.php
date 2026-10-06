<?php

namespace App\Policies;

use App\Models\KeyResultCheckin;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Check-ins are append-only and read with their key result (KeyResultPolicy);
 * they are recorded through KeyResultPolicy::checkin.
 */
class KeyResultCheckinPolicy
{
    public function __construct(private readonly KeyResultPolicy $keyResults) {}

    public function view(User $user, KeyResultCheckin $checkin): Response
    {
        return $this->keyResults->view($user, $checkin->keyResult);
    }

    public function update(User $user, KeyResultCheckin $checkin): bool
    {
        return false;
    }

    public function delete(User $user, KeyResultCheckin $checkin): bool
    {
        return false;
    }
}
