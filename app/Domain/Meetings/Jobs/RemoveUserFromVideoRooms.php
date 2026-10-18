<?php

namespace App\Domain\Meetings\Jobs;

use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\MeetingAttendance;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * An account was deactivated (DeactivateEmployee): remove the person from
 * every video room they are still in (open meeting_attendances rows), so a
 * running LiveKit session does not outlive the account (audit R-09). New
 * tokens are refused already (MeetingPolicy::canView requires an active
 * account). Failures per room are logged, not retried forever.
 */
final class RemoveUserFromVideoRooms implements ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $userId) {}

    public function handle(VideoRooms $rooms, LiveKitRoomService $service): int
    {
        if (! $rooms->configured()) {
            return 0;
        }

        $removed = 0;
        $roomNames = MeetingAttendance::query()
            ->where('user_id', $this->userId)
            ->whereNull('left_at')
            ->distinct()
            ->pluck('room');

        foreach ($roomNames as $room) {
            try {
                $service->removeParticipant((string) $room, $this->userId);
                $removed++;
            } catch (RuntimeException $exception) {
                Log::warning('meetings.video_remove_deactivated_failed', ['room' => $room, 'error' => $exception->getMessage()]);
            }
        }

        return $removed;
    }
}
