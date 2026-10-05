<?php

namespace App\Domain\Requests\Actions;

use App\Models\LeaveType;
use App\Models\User;

/**
 * Soft delete: past requests keep their type (relations load trashed types)
 * and the code stays reserved so old numbers keep their meaning.
 */
final class DeleteLeaveType
{
    public function handle(User $actor, LeaveType $type): void
    {
        $type->delete();
    }
}
