<?php

namespace App\Domain\Notifications\Contracts;

use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Answers "is this user on approved leave at this moment?".
 *
 * Used for the "Saat saya cuti, tahan semua notifikasi" setting and the daily
 * digest. The default binding (AlwaysAvailable) returns false; the Requests
 * module (Sprint 4) binds a real implementation in a service provider:
 *
 *     $this->app->bind(UserAvailability::class, ApprovedLeaveAvailability::class);
 */
interface UserAvailability
{
    public function isOnLeave(User $user, CarbonInterface $at): bool;
}
