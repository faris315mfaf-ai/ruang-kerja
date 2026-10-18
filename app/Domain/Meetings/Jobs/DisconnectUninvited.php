<?php

namespace App\Domain\Meetings\Jobs;

use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\MinutesCollab;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\MeetingAttendance;
use App\Models\MeetingMinutes;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * People were taken off a meeting's invitation (UpdateMeeting): remove them
 * from the meeting's video rooms they are still in, and make every editor of
 * the meeting's draft collaborative minutes reconnect (a fresh token is
 * refused for them: MeetingPolicy::canView / openVideo). Audit rapat
 * 2026-10 B-07, like R-09 for deactivated accounts.
 */
final class DisconnectUninvited implements ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $tries = 3;

    /**
     * @param  list<string>  $userIds
     */
    public function __construct(public readonly string $meetingId, public readonly array $userIds) {}

    public function handle(VideoRooms $rooms, LiveKitRoomService $service, MinutesCollab $collab): int
    {
        $removed = 0;

        if ($rooms->configured() && $this->userIds !== []) {
            MeetingAttendance::query()
                ->where('meeting_id', $this->meetingId)
                ->whereIn('user_id', $this->userIds)
                ->whereNull('left_at')
                ->get(['room', 'user_id'])
                ->unique(fn (MeetingAttendance $row): string => $row->room.'|'.$row->user_id)
                ->each(function (MeetingAttendance $row) use ($service, &$removed): void {
                    try {
                        $service->removeParticipant($row->room, (string) $row->user_id);
                        $removed++;
                    } catch (RuntimeException $exception) {
                        Log::warning('meetings.video_remove_uninvited_failed', ['room' => $row->room, 'error' => $exception->getMessage()]);
                    }
                });
        }

        if (MinutesCollab::enabled()) {
            MeetingMinutes::query()
                ->where('meeting_id', $this->meetingId)
                ->where('status', 'draft')
                ->get(['id', 'meeting_id', 'occurrence_date'])
                ->each(fn (MeetingMinutes $minutes) => $collab->reconnect($minutes));
        }

        return $removed;
    }
}
