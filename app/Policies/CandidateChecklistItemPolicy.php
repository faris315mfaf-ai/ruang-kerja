<?php

namespace App\Policies;

use App\Domain\Hiring\Services\HiringAccess;
use App\Models\CandidateChecklistItem;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Checklist items: every reviewer ticks only their own items (HR items =
 * any HR); HR adds items and removes unticked ones. Invisible candidate → 404.
 */
class CandidateChecklistItemPolicy
{
    public function __construct(
        private readonly HiringAccess $access,
        private readonly CandidatePolicy $candidates,
    ) {}

    public function view(User $user, CandidateChecklistItem $item): Response
    {
        return $this->candidates->view($user, $item->loadMissing('candidate.hiringPosition')->candidate);
    }

    public function check(User $user, CandidateChecklistItem $item): Response
    {
        if (! $this->candidates->canView($user, $item->loadMissing('candidate.hiringPosition')->candidate)) {
            return Response::denyAsNotFound();
        }

        if ($item->loadMissing('candidate.hiringPosition')->candidate->stage->isFinal()) {
            return Response::deny('Kandidat sudah diputus; checklist tidak bisa diubah lagi.');
        }

        $own = $item->reviewer_id === null ? $this->access->isManager($user) : $item->reviewer_id === $user->id;

        return $own ? Response::allow() : Response::deny('Anda hanya dapat mencentang butir milik Anda.');
    }

    public function delete(User $user, CandidateChecklistItem $item): Response
    {
        $manage = $this->candidates->manage($user, $item->loadMissing('candidate.hiringPosition')->candidate);

        if ($manage->denied()) {
            return $manage;
        }

        return $item->isChecked()
            ? Response::deny('Butir yang sudah dicentang tidak bisa dihapus.')
            : Response::allow();
    }
}
