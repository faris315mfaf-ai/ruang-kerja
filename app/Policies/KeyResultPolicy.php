<?php

namespace App\Policies;

use App\Models\KeyResult;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Key results follow their objective (ObjectivePolicy): invisible → 404.
 * Edit, check in and link tasks: the key result owner, the objective owner
 * and the Kepala Divisi of the division. Remove: the objective owner and the
 * Kepala Divisi. Closed objective → read-only (403).
 */
class KeyResultPolicy
{
    public function __construct(private readonly ObjectivePolicy $objectives) {}

    public function view(User $user, KeyResult $keyResult): Response
    {
        return $this->objectives->view($user, $keyResult->objective);
    }

    public function update(User $user, KeyResult $keyResult): Response
    {
        return $this->contribute($user, $keyResult, 'mengubah key result ini');
    }

    public function checkin(User $user, KeyResult $keyResult): Response
    {
        return $this->contribute($user, $keyResult, 'mencatat check-in key result ini');
    }

    public function linkTask(User $user, KeyResult $keyResult): Response
    {
        return $this->contribute($user, $keyResult, 'menautkan tugas ke key result ini');
    }

    public function delete(User $user, KeyResult $keyResult): Response
    {
        return $this->objectives->createKeyResult($user, $keyResult->objective);
    }

    private function contribute(User $user, KeyResult $keyResult, string $what): Response
    {
        $objective = $keyResult->objective;

        if (! $this->objectives->canView($user, $objective)) {
            return Response::denyAsNotFound();
        }

        if ($objective->isClosed()) {
            return Response::deny('Objective sudah ditutup dan hanya bisa dibaca.');
        }

        $allowed = $keyResult->owner_id === $user->id
            || $objective->owner_id === $user->id
            || $this->objectives->leadsDivision($user, $objective);

        return $allowed
            ? Response::allow()
            : Response::deny("Hanya pemilik key result, pemilik objective, atau Kepala Divisi yang dapat {$what}.");
    }
}
