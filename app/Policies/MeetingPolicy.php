<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Meetings and their minutes (F2-3, docs/fitur/rapat-kalender.md):
 *
 * - See (detail + minutes): organizer, minute taker, internal participants;
 *   leadership meetings also dashboard.view_company (Direksi, HR, Super
 *   Admin) for /manajemen/jadwal. Same company, active account. Otherwise
 *   404 — Meeting::scopeVisibleTo applies the same rules to lists.
 * - Change / cancel / reopen final minutes: organizer.
 * - RSVP: the participant.
 * - Write minutes (draft only), finalize, follow-ups → tasks, remind owners:
 *   minute taker or organizer.
 * - Tick a follow-up off: its assignee or the minute taker / organizer.
 * No Gate::before: Super Admin has no extra rights here.
 */
class MeetingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function create(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Meeting $meeting): Response
    {
        return $this->canView($user, $meeting) ? Response::allow() : Response::denyAsNotFound();
    }

    public function update(User $user, Meeting $meeting): Response
    {
        if (! $this->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        if ($meeting->isCanceled()) {
            return Response::deny('Rapat ini sudah dibatalkan.');
        }

        return $this->isOrganizer($user, $meeting)
            ? Response::allow()
            : Response::deny('Hanya penyelenggara yang dapat mengubah rapat ini.');
    }

    public function cancel(User $user, Meeting $meeting): Response
    {
        return $this->update($user, $meeting);
    }

    public function respond(User $user, Meeting $meeting): Response
    {
        if (! $this->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        if ($meeting->isCanceled()) {
            return Response::deny('Rapat ini sudah dibatalkan.');
        }

        return $meeting->participantFor($user) !== null
            ? Response::allow()
            : Response::deny('Anda tidak diundang ke rapat ini.');
    }

    public function editMinutes(User $user, Meeting $meeting, ?MeetingMinutes $minutes = null): Response
    {
        if (! $this->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        if (! $this->canWriteMinutes($user, $meeting)) {
            return Response::deny('Hanya notulis atau penyelenggara yang dapat menulis notulen.');
        }

        return $minutes?->isFinal() === true
            ? Response::deny('Notulen sudah final. Buka kembali draf untuk mengubahnya.')
            : Response::allow();
    }

    public function finalizeMinutes(User $user, Meeting $meeting, MeetingMinutes $minutes): Response
    {
        return $this->editMinutes($user, $meeting, $minutes);
    }

    public function reopenMinutes(User $user, Meeting $meeting, MeetingMinutes $minutes): Response
    {
        if (! $this->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        if (! $this->isOrganizer($user, $meeting)) {
            return Response::deny('Hanya penyelenggara yang dapat membuka kembali notulen.');
        }

        return $minutes->isFinal() ? Response::allow() : Response::deny('Notulen masih berupa draf.');
    }

    /** "Jadikan tugas" and "Ingatkan PIC": works on draft and final minutes. */
    public function manageActionItems(User $user, Meeting $meeting): Response
    {
        if (! $this->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        return $this->canWriteMinutes($user, $meeting)
            ? Response::allow()
            : Response::deny('Hanya notulis atau penyelenggara yang dapat mengelola tindak lanjut.');
    }

    /** Tick a follow-up off (also after the minutes are final). */
    public function completeActionItem(User $user, Meeting $meeting, MeetingActionItem $item): Response
    {
        if (! $this->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        return $item->assignee_id === $user->id || $this->canWriteMinutes($user, $meeting)
            ? Response::allow()
            : Response::deny('Hanya penanggung jawab, notulis, atau penyelenggara yang dapat menandai tindak lanjut.');
    }

    public function canView(User $user, Meeting $meeting): bool
    {
        if (! $user->isActive() || $meeting->company_id !== $user->company_id) {
            return false;
        }

        return $meeting->involves($user)
            || ($meeting->leadership && $user->hasPermission(Permission::DashboardViewCompany));
    }

    public function canWriteMinutes(User $user, Meeting $meeting): bool
    {
        return $this->canView($user, $meeting)
            && ($this->isOrganizer($user, $meeting) || $meeting->minute_taker_id === $user->id);
    }

    public function isOrganizer(User $user, Meeting $meeting): bool
    {
        return $meeting->organizer_id === $user->id;
    }
}
