<?php

namespace App\Policies;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use Carbon\CarbonImmutable;
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
 * - Video room (platform `video`): organizer, minute taker and internal
 *   participants open the pre-join/room pages; a token is issued only inside
 *   the join window (VideoRooms; organizer any time). Leadership observers
 *   who were not invited do not join. Mute / remove others: organizer.
 *   "Panggil" a missing participant: organizer or minute taker. Speaking
 *   time is reported inside the join window (joinVideo) and read by anyone
 *   who may open the room (openVideo).
 * - External guests of a video meeting (docs/sesi/rapat-tamu-eksternal.md):
 *   guest list, adding, revoking and rotating links = organizer only
 *   (manageGuests); admitting / denying someone in the waiting room =
 *   organizer, minute taker and internal participants (manageLobby). Guests
 *   themselves have no account and never reach this policy.
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

    /** Pre-join and room pages of the built-in video room (any time). */
    public function openVideo(User $user, Meeting $meeting): Response
    {
        if (! $this->canView($user, $meeting) || $meeting->platform !== MeetingPlatform::Video) {
            return Response::denyAsNotFound();
        }

        if ($meeting->isCanceled()) {
            return Response::deny('Rapat ini sudah dibatalkan.');
        }

        return $meeting->involves($user)
            ? Response::allow()
            : Response::deny('Anda tidak diundang ke rapat ini.');
    }

    /**
     * A LiveKit token for one occurrence: openVideo + inside the join window
     * + not removed from that occurrence's room by the organizer (R-04).
     * Deactivated accounts fail canView (isActive) and get nothing.
     */
    public function joinVideo(User $user, Meeting $meeting, ?Occurrence $occurrence = null, ?CarbonImmutable $now = null): Response
    {
        $open = $this->openVideo($user, $meeting);

        if ($open->denied() || $this->isOrganizer($user, $meeting)) {
            return $open;
        }

        if ($occurrence === null) {
            return Response::deny('Pilih tanggal rapat.');
        }

        $removed = MeetingVideoRemoval::query()
            ->where('meeting_id', $meeting->id)
            ->where('occurrence_date', $occurrence->date)
            ->where('user_id', $user->id)
            ->exists();

        if ($removed) {
            return Response::deny('Penyelenggara mengeluarkan Anda dari rapat ini.');
        }

        $rooms = app(VideoRooms::class);

        return match ($rooms->windowState($occurrence, $now)) {
            'early' => Response::deny('Ruang rapat dibuka pukul '.$rooms->opensAt($occurrence)->setTimezone(CurrentCompany::timezone())->format('H.i').'.'),
            'closed' => Response::deny('Rapat sudah selesai. Ruang rapat sudah ditutup.'),
            default => Response::allow(),
        };
    }

    /**
     * "Panggil" an invited person who is not in the video room yet, and
     * choose how the notes start (pre-join): organizer or minute taker.
     */
    public function callParticipant(User $user, Meeting $meeting): Response
    {
        $open = $this->openVideo($user, $meeting);

        if ($open->denied()) {
            return $open;
        }

        return $this->canWriteMinutes($user, $meeting)
            ? Response::allow()
            : Response::deny('Hanya notulis atau penyelenggara yang dapat memanggil peserta.');
    }

    /** Mute or remove someone in the video room. */
    public function moderateVideo(User $user, Meeting $meeting): Response
    {
        $open = $this->openVideo($user, $meeting);

        if ($open->denied()) {
            return $open;
        }

        return $this->isOrganizer($user, $meeting)
            ? Response::allow()
            : Response::deny('Hanya penyelenggara yang dapat mengatur peserta rapat.');
    }

    /** Guest list with their links, add / revoke / rotate: the organizer of a video meeting. */
    public function manageGuests(User $user, Meeting $meeting): Response
    {
        return $this->moderateVideo($user, $meeting);
    }

    /** Waiting room: see who waits, admit or deny — everyone invited to the video meeting. */
    public function manageLobby(User $user, Meeting $meeting): Response
    {
        return $this->openVideo($user, $meeting);
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
