<?php

namespace App\Domain\Meetings\Guests\Actions;

use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Domain\Meetings\Services\MeetingParticipants;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;

/**
 * Organizer invites an external guest (e-mail, optional name) to a meeting:
 * the guest gets a personal link the organizer copies and sends by hand —
 * the app sends no e-mail. Adding an e-mail that is already invited keeps its
 * link and only updates the name. Audit `meeting.guest_added` (no token).
 */
final class AddMeetingGuest
{
    /** Per meeting; the form allows 30 e-mail addresses too. */
    public const int MAX_GUESTS = 30;

    public function __construct(
        private readonly MeetingParticipants $participants,
        private readonly GuestLinks $links,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, Meeting $meeting, string $email, ?string $name): MeetingParticipant
    {
        $email = mb_strtolower(trim($email));
        $existing = MeetingParticipant::query()->where('meeting_id', $meeting->id)->where('email', $email)->exists();

        $guest = $this->participants->addGuests($meeting, [$email], [$email => $name])[0];

        if (! $existing) {
            $this->audit->log('meeting.guest_added', $meeting, null, [
                'participant_id' => $guest->id,
                'email' => $email,
                'guest_name' => $guest->guest_name,
            ], $actor);
        }

        $meeting->unsetRelation('participants');

        return $this->links->ensure($guest->refresh(), $meeting);
    }
}
