<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Models\Division;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * OKR divisi (docs/fitur/okr.md §2). Reading: employees of the division, its
 * Kepala Divisi, the owners of the objective / a key result, and the
 * company-wide readers (Direksi, HR, Super Admin = dashboard.view_company).
 * Invisible → 404 (Objective::visibleTo is the list twin). Creating and
 * editing an objective: the Kepala Divisi of the division and Direksi.
 * Key results: the objective owner and the Kepala Divisi (KeyResultPolicy).
 * A closed objective is read-only (403). No Gate::before.
 */
class ObjectivePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Objective $objective): Response
    {
        return $this->canView($user, $objective) ? Response::allow() : Response::denyAsNotFound();
    }

    /**
     * Whether the user may create objectives at all (button on /okr).
     */
    public function createAny(User $user): bool
    {
        return $user->isActive() && ($user->hasRole(Role::Direksi) || $user->ledDivisionIds() !== []);
    }

    public function create(User $user, Division $division): Response
    {
        return $this->canManageDivision($user, $division->company_id, $division->id)
            ? Response::allow()
            : Response::deny('Hanya Kepala Divisi atau Direksi yang dapat membuat objective divisi ini.');
    }

    public function update(User $user, Objective $objective): Response
    {
        if (! $this->canView($user, $objective)) {
            return Response::denyAsNotFound();
        }

        return $this->canManageDivision($user, $objective->company_id, $objective->division_id)
            ? Response::allow()
            : Response::deny('Hanya Kepala Divisi atau Direksi yang dapat mengubah objective ini.');
    }

    public function close(User $user, Objective $objective): Response
    {
        $update = $this->update($user, $objective);

        if ($update->denied()) {
            return $update;
        }

        return $objective->isClosed() ? Response::deny('Objective ini sudah ditutup.') : Response::allow();
    }

    /**
     * Add (and remove) key results: the objective owner and the Kepala Divisi.
     */
    public function createKeyResult(User $user, Objective $objective): Response
    {
        if (! $this->canView($user, $objective)) {
            return Response::denyAsNotFound();
        }

        if ($objective->isClosed()) {
            return Response::deny('Objective sudah ditutup dan hanya bisa dibaca.');
        }

        return $objective->owner_id === $user->id || $this->leadsDivision($user, $objective)
            ? Response::allow()
            : Response::deny('Hanya pemilik objective atau Kepala Divisi yang dapat menambah key result.');
    }

    public function canView(User $user, Objective $objective): bool
    {
        if ($user->company_id !== $objective->company_id || ! $user->isActive()) {
            return false;
        }

        if ($user->hasPermission(Permission::DashboardViewCompany) || $objective->owner_id === $user->id) {
            return true;
        }

        if (in_array($objective->division_id, Objective::divisionScopeFor($user), true)) {
            return true;
        }

        return $objective->relationLoaded('keyResults')
            ? $objective->keyResults->contains('owner_id', $user->id)
            : $objective->keyResults()->where('owner_id', $user->id)->exists();
    }

    public function leadsDivision(User $user, Objective $objective): bool
    {
        return $user->company_id === $objective->company_id
            && $user->isActive()
            && in_array($objective->division_id, $user->ledDivisionIds(), true);
    }

    private function canManageDivision(User $user, string $companyId, string $divisionId): bool
    {
        if ($user->company_id !== $companyId || ! $user->isActive()) {
            return false;
        }

        return $user->hasRole(Role::Direksi) || in_array($divisionId, $user->ledDivisionIds(), true);
    }
}
