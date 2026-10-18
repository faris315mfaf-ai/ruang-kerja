<?php

namespace App\Domain\Meetings\Guests\Actions;

use App\Domain\Meetings\Guests\Jobs\RemoveGuestsFromRooms;
use App\Domain\Meetings\Guests\Services\GuestAccess;
use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Putar ulang tautan": a new personal link for the guest. The old link stops
 * working immediately, the guest's waiting-room state is cleared and a guest
 * who is in the room right now is removed (a leaked link has to be harmless
 * afterwards). Audit `meeting.guest_link_rotated`.
 */
final class RotateGuestLink
{
    public function __construct(
        private readonly GuestLinks $links,
        private readonly GuestAccess $access,
        private readonly RoomEvents $events,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, Meeting $meeting, MeetingParticipant $guest): MeetingParticipant
    {
        RemoveGuestsFromRooms::forParticipants($meeting, [(string) $guest->id]);

        DB::transaction(function () use ($actor, $meeting, $guest): void {
            $this->links->rotate($guest, $meeting);
            $this->audit->log('meeting.guest_link_rotated', $meeting, null, [
                'participant_id' => $guest->id,
                'email' => $guest->email,
            ], $actor);
        });

        if ($meeting->platform->value === 'video') {
            $this->events->lobbyUpdated($this->access->occurrence($meeting), MeetingParticipant::query()
                ->where('meeting_id', $meeting->id)->where('lobby_status', 'waiting')->count());
        }

        return $guest->refresh();
    }
}
