<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\MinutesCollab;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use InvalidArgumentException;

/**
 * Organizer removes someone from the video room (MeetingPolicy::moderateVideo),
 * audited as `meeting.video_participant_removed`. An employee removed this
 * way is kept out of that occurrence's room (meeting_video_removals:
 * joinVideo refuses a new token, audit R-04) until the organizer re-admits
 * them (ReadmitVideoParticipant); in the collaborative minutes they only
 * read meanwhile (editors reconnect). The block is stored before LiveKit is
 * called, so a failing Room Service call (RuntimeException) still keeps
 * them from rejoining.
 */
final class RemoveVideoParticipant
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitRoomService $service,
        private readonly AuditLogger $audit,
        private readonly MinutesStore $store,
        private readonly MinutesCollab $collab,
    ) {}

    public function handle(User $actor, Occurrence $occurrence, string $identity): void
    {
        if ($identity === $actor->id) {
            throw new InvalidArgumentException('Use the leave button to leave the room yourself.');
        }

        $userId = User::query()->whereKey($identity)->where('company_id', $occurrence->meeting->company_id)->value('id');

        if (is_string($userId)) {
            MeetingVideoRemoval::query()->updateOrCreate(
                ['meeting_id' => $occurrence->meeting->id, 'occurrence_date' => $occurrence->date, 'user_id' => $userId],
                ['removed_by' => $actor->id],
            );
        }

        $this->audit->log('meeting.video_participant_removed', $occurrence->meeting, null, [
            'occurrence_date' => $occurrence->date,
            'identity' => $identity,
        ], $actor);

        // Collaborative minutes: editors reconnect with fresh tokens, read-only for
        // the removed person (MinutesCollab::canEdit, audit rapat 2026-10 B-02).
        $minutes = $this->store->find($occurrence);

        if ($minutes !== null) {
            $this->collab->reconnect($minutes);
        }

        $this->service->removeParticipant($this->rooms->roomName($occurrence), $identity);
    }
}
