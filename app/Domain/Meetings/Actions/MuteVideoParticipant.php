<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use InvalidArgumentException;

/**
 * Organizer mutes someone's published microphone in the video room
 * (MeetingPolicy::moderateVideo). Like Google Meet, the person can unmute
 * themselves again. Throws RuntimeException when LiveKit fails.
 */
final class MuteVideoParticipant
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitRoomService $service,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, Occurrence $occurrence, string $identity, string $trackSid): void
    {
        if ($identity === $actor->id) {
            throw new InvalidArgumentException('Use the room controls for your own microphone.');
        }

        $this->service->mutePublishedTrack($this->rooms->roomName($occurrence), $identity, $trackSid);

        // Audit R-08: muting someone is recorded like removing them.
        $this->audit->log('meeting.video_participant_muted', $occurrence->meeting, null, [
            'occurrence_date' => $occurrence->date,
            'identity' => $identity,
            'track_sid' => $trackSid,
        ], $actor);
    }
}
