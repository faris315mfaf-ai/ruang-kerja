<?php

namespace App\Policies;

use App\Domain\Automation\Services\AutomationAccess;
use App\Models\RecurringTask;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Recurring tasks (F2-4): seen by the workspace's members; created by members
 * who may create tasks there (not viewers); changed, paused, run now and
 * deleted by their creator (while still able to create tasks) or the
 * workspace's owner/admin. Not a member → 404.
 */
class RecurringTaskPolicy
{
    public function __construct(private readonly AutomationAccess $access) {}

    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, RecurringTask $recurring): Response
    {
        return $this->access->isMember($user, $recurring->workspace) ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $user, Workspace $workspace): Response
    {
        return $this->access->gate(
            $user,
            $workspace,
            $this->access->canEditTasks($user, $workspace),
            'Anda tidak bisa membuat tugas di workspace ini.',
        );
    }

    public function update(User $user, RecurringTask $recurring): Response
    {
        $workspace = $recurring->workspace;
        $allowed = $this->access->canManage($user, $workspace)
            || ($recurring->created_by === $user->id && $this->access->canEditTasks($user, $workspace));

        return $this->access->gate($user, $workspace, $allowed, 'Hanya pembuat atau admin workspace yang bisa mengubah tugas berulang ini.');
    }

    public function delete(User $user, RecurringTask $recurring): Response
    {
        return $this->update($user, $recurring);
    }

    /**
     * "Buat sekarang".
     */
    public function run(User $user, RecurringTask $recurring): Response
    {
        return $this->update($user, $recurring);
    }
}
