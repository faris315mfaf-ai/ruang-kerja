<?php

namespace App\Domain\Meetings\Guests\Actions;

use App\Domain\Meetings\Guests\Jobs\RemoveGuestsFromRooms;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Cabut tamu": the guest leaves the invitation altogether — the row (and so
 * the link) is deleted and a guest in the room is removed. Audit
 * `meeting.guest_removed`.
 */
final class RevokeMeetingGuest
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, Meeting $meeting, MeetingParticipant $guest): void
    {
        RemoveGuestsFromRooms::forParticipants($meeting, [(string) $guest->id]);

        DB::transaction(function () use ($actor, $meeting, $guest): void {
            $this->audit->log('meeting.guest_removed', $meeting, null, [
                'participant_id' => $guest->id,
                'email' => $guest->email,
                'guest_name' => $guest->guest_name,
            ], $actor);
            $guest->delete();
        });

        $meeting->unsetRelation('participants');
    }
}
