<?php

namespace App\Domain\Meetings\Guests;

use App\Domain\Meetings\Data\Occurrence;
use App\Models\MeetingParticipant;

/**
 * Where one guest link stands right now (GuestAccess::inspect).
 *
 * `status`: none · waiting · admitted · denied · removed (waiting room of the
 * current occurrence) or expired · closed (the link / the meeting is over).
 * `window`: early · open · closed (the occurrence's join window).
 * `occurrence` is null only when the meeting is gone, canceled or not video.
 */
final readonly class GuestState
{
    public function __construct(
        public MeetingParticipant $participant,
        public string $status,
        public string $window,
        public ?Occurrence $occurrence,
    ) {}

    /** The link is still good: the page may show the meeting. */
    public function live(): bool
    {
        return ! in_array($this->status, ['expired', 'closed'], true);
    }
}
