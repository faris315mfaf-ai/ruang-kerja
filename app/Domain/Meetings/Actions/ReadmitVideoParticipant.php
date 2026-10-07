<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingVideoRemoval;
use App\Models\User;

/**
 * "Izinkan masuk lagi": the organizer lifts the removal of someone from the
 * video room of an occurrence (audit R-04), audited as
 * `meeting.video_participant_readmitted`. Returns whether a block existed.
 */
final class ReadmitVideoParticipant
{
    public function __construct(private readonly AuditLogger $audit) {}

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
        }

        return $deleted > 0;
    }
}
