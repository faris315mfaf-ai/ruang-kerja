<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MinutesCollab;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingVideoRemoval;
use App\Models\User;

/**
 * "Izinkan masuk lagi": the organizer lifts the removal of someone from the
 * video room of an occurrence (audit R-04), audited as
 * `meeting.video_participant_readmitted`. Broadcast `participant.readmitted`
 * (the person's client fetches fresh video/collab tokens) and the
 * collaborative minutes reconnect so they can edit again (audit B-08).
 * Returns whether a block existed.
 */
final class ReadmitVideoParticipant
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RoomEvents $events,
        private readonly MinutesStore $store,
        private readonly MinutesCollab $collab,
    ) {}

    public function handle(User $actor, Occurrence $occurrence, string $userId): bool
    {
        $deleted = MeetingVideoRemoval::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->where('occurrence_date', $occurrence->date)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted > 0) {
            $this->audit->log('meeting.video_participant_readmitted', $occurrence->meeting, null, [
                'occurrence_date' => $occurrence->date,
                'user_id' => $userId,
            ], $actor);

            $this->events->participantReadmitted($occurrence, $userId, $actor->id);
            $minutes = $this->store->find($occurrence);

            if ($minutes !== null) {
                $this->collab->reconnect($minutes);
            }
        }

        return $deleted > 0;
    }
}
