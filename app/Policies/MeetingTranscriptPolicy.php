<?php

namespace App\Policies;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * "Notulen otomatis" of a meeting (docs/fitur/notulen-otomatis-kontrak.md §4).
 * Called with the meeting: Gate::authorize('view', [MeetingTranscript::class, $meeting]).
 *
 * - status: anyone who sees the meeting (MeetingPolicy::canView);
 * - view (transcript text, review page) and consent (own opt-out): people
 *   involved in the meeting — organizer, minute taker, internal participants.
 *   Leadership observers who were not invited do not read transcripts;
 * - configure (auto_minutes): the organizer, video meetings, not canceled;
 * - manage (insert / discard / re-run draft, suggestions → tasks): minute
 *   taker or organizer.
 * Invisible meeting → 404.
 */
class MeetingTranscriptPolicy
{
    public function __construct(private readonly MeetingPolicy $meetings) {}

    public function status(User $user, Meeting $meeting): Response
    {
        return $this->meetings->canView($user, $meeting) ? Response::allow() : Response::denyAsNotFound();
    }

    public function view(User $user, Meeting $meeting): Response
    {
        if (! $this->meetings->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        return $meeting->involves($user)
            ? Response::allow()
            : Response::deny('Transkrip hanya untuk peserta rapat.');
    }

    public function consent(User $user, Meeting $meeting): Response
    {
        $view = $this->view($user, $meeting);

        if ($view->denied()) {
            return $view;
        }

        return $meeting->isCanceled() ? Response::deny('Rapat ini sudah dibatalkan.') : Response::allow();
    }

    public function configure(User $user, Meeting $meeting): Response
    {
        if (! $this->meetings->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        if (! $this->meetings->isOrganizer($user, $meeting)) {
            return Response::deny('Hanya penyelenggara yang dapat mengatur notulen otomatis.');
        }

        if ($meeting->isCanceled()) {
            return Response::deny('Rapat ini sudah dibatalkan.');
        }

        return $meeting->platform === MeetingPlatform::Video
            ? Response::allow()
            : Response::deny('Notulen otomatis hanya untuk rapat Video RuangKerja.');
    }

    public function manage(User $user, Meeting $meeting): Response
    {
        if (! $this->meetings->canView($user, $meeting)) {
            return Response::denyAsNotFound();
        }

        return $this->meetings->canWriteMinutes($user, $meeting)
            ? Response::allow()
            : Response::deny('Hanya notulis atau penyelenggara yang dapat mengelola draf notulen otomatis.');
    }
}
