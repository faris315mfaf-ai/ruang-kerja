<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use InvalidArgumentException;

/**
 * Organizer removes someone from the video room (MeetingPolicy::moderateVideo),
 * audited as `meeting.video_participant_removed`. The person may rejoin with
 * a new token while the join window is open (no ban list yet). Throws
 * RuntimeException when LiveKit fails.
 */
final class RemoveVideoParticipant
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitRoomService $service,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, Occurrence $occurrence, string $identity): void
    {
        if ($identity === $actor->id) {
            throw new InvalidArgumentException('Use the leave button to leave the room yourself.');
        }

        $this->service->removeParticipant($this->rooms->roomName($occurrence), $identity);

        $this->audit->log('meeting.video_participant_removed', $occurrence->meeting, null, [
            'occurrence_date' => $occurrence->date,
            'identity' => $identity,
        ], $actor);
    }
}
