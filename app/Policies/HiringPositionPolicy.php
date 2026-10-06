<?php

namespace App\Policies;

use App\Domain\Hiring\Services\HiringAccess;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Hiring positions (docs/fitur/hiring.md). HR & Super Admin manage every
 * position of the company; assigned interviewers and final approvers see
 * (read-only) the positions they are on; anyone else gets 404.
 */
class HiringPositionPolicy
{
    public function __construct(private readonly HiringAccess $access) {}

    /** The Hiring space itself (/hiring). Lists go through HiringPosition::visibleTo(). */
    public function viewAny(User $user): Response
    {
        return $this->access->canEnter($user) ? Response::allow() : Response::denyAsNotFound();
    }

    public function view(User $user, HiringPosition $position): Response
    {
        return $this->canView($user, $position) ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $user): Response
    {
        return $this->managerOnly($user, null);
    }

    /** Edit details, reviewers, questions, field mapping, webhook; add candidates by hand. */
    public function update(User $user, HiringPosition $position): Response
    {
        return $this->managerOnly($user, $position);
    }

    public function delete(User $user, HiringPosition $position): Response
    {
        return $this->managerOnly($user, $position);
    }

    public function canView(User $user, HiringPosition $position): bool
    {
        if (! $user->isActive() || $position->company_id !== $user->company_id || $position->trashed()) {
            return false;
        }

        return $this->access->isManager($user) || $position->isReviewer($user);
    }

    private function managerOnly(User $user, ?HiringPosition $position): Response
    {
        if ($position !== null ? ! $this->canView($user, $position) : ! $this->access->canEnter($user)) {
            return Response::denyAsNotFound();
        }

        return $this->access->isManager($user)
            ? Response::allow()
            : Response::deny('Hanya HR yang dapat mengelola lowongan.');
    }
}
