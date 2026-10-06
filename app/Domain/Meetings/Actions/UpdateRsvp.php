<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\Rsvp;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;

/**
 * "Kehadiran Anda": the participant answers Hadir / Mungkin / Tidak hadir.
 * Applies to the whole series.
 */
final class UpdateRsvp
{
    public function handle(Meeting $meeting, User $user, Rsvp $rsvp): MeetingParticipant
    {
        $participant = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $participant->forceFill([
            'rsvp' => $rsvp,
            'responded_at' => $rsvp === Rsvp::Pending ? null : now(),
        ])->save();

        return $participant;
    }
}
