<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\ManagementNote;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * "Catatan tindakan" (keputusan pemilik 6 Okt 2026): management (Direksi, HR,
 * Super Admin = dashboard.view_company, the people of /manajemen) keep a
 * private to-do list. Nobody but the owner reads or changes a note — another
 * person's note answers 404, not even Super Admin sees it.
 */
class ManagementNotePolicy
{
    /**
     * Lists are always ManagementNote::ownedBy($user).
     */
    public function viewAny(User $user): bool
    {
        return $this->create($user);
    }

    public function create(User $user): bool
    {
        return $user->isActive() && $user->hasPermission(Permission::DashboardViewCompany);
    }

    public function view(User $user, ManagementNote $note): Response
    {
        return $this->owns($user, $note) ? Response::allow() : Response::denyAsNotFound();
    }

    public function update(User $user, ManagementNote $note): Response
    {
        if (! $this->owns($user, $note)) {
            return Response::denyAsNotFound();
        }

        return $this->create($user) ? Response::allow() : Response::deny('Catatan tindakan hanya untuk manajemen.');
    }

    public function delete(User $user, ManagementNote $note): Response
    {
        return $this->update($user, $note);
    }

    private function owns(User $user, ManagementNote $note): bool
    {
        return $note->user_id === $user->id && $note->company_id === $user->company_id;
    }
}
