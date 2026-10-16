<?php

namespace App\Domain\Meetings\Guests\Services;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Guests\GuestState;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use Carbon\CarbonImmutable;

/**
 * Evaluates a guest link: which occurrence it opens now, whether its join
 * window is open and where the guest stands in the waiting room. One
 * occurrence at a time: a guest admitted to Monday's rapat is a stranger
 * again on Tuesday's (lobby_occurrence_date).
 */
final class GuestAccess
{
    /** How far ahead a series is searched for the next occurrence once today's is over. */
    private const int LOOKAHEAD_DAYS = 30;

    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly VideoRooms $rooms,
    ) {}

    public function inspect(MeetingParticipant $guest, ?CarbonImmutable $now = null): GuestState
    {
        $now ??= CarbonImmutable::now();
        $meeting = $guest->meeting;

        // Not a video meeting any more, deleted or canceled: nothing to join.
        if ($meeting->platform !== MeetingPlatform::Video || $meeting->isCanceled()) {
            return new GuestState($guest, 'closed', 'closed', null);
        }

        $occurrence = $this->occurrence($meeting, $now);
        $window = $this->rooms->windowState($occurrence, $now);

        if ($window === 'closed') {
            return new GuestState($guest, 'closed', 'closed', $occurrence);
        }

        if ($guest->link_expires_at === null || $guest->link_expires_at->lte($now)) {
            return new GuestState($guest, 'expired', $window, $occurrence);
        }

        return new GuestState($guest, $this->lobbyStatus($guest, $occurrence)->value, $window, $occurrence);
    }

    /** The waiting-room status of the guest for this occurrence ("none" when it concerns another date). */
    public function lobbyStatus(MeetingParticipant $guest, Occurrence $occurrence): LobbyStatus
    {
        return $guest->lobby_occurrence_date?->toDateString() === $occurrence->date
            ? $guest->lobby_status
            : LobbyStatus::None;
    }

    /** Today's / the upcoming occurrence; once today's window is over, the next date of a series. */
    public function occurrence(Meeting $meeting, ?CarbonImmutable $now = null): Occurrence
    {
        $now ??= CarbonImmutable::now();
        $occurrence = $this->occurrences->resolve($meeting, null, $now);

        if (! $meeting->isRecurring() || $this->rooms->windowState($occurrence, $now) !== 'closed') {
            return $occurrence;
        }

        $day = CarbonImmutable::parse($occurrence->date, config()->string('app.office_timezone'))->addDay();

        for ($i = 0; $i < self::LOOKAHEAD_DAYS; $i++, $day = $day->addDay()) {
            $next = $this->occurrences->at($meeting, $day->toDateString());

            if ($next !== null) {
                return $next;
            }
        }

        return $occurrence;
    }
}
