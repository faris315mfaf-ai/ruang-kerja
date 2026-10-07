<?php

namespace App\Domain\Meetings\Jobs;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * A video meeting was canceled (CancelMeeting): every LiveKit room of it
 * that may be live — rooms with someone still inside (meeting_attendances)
 * and the room of the current/next occurrence — is deleted through the Room
 * Service API, which disconnects everyone (audit R-09). Tokens are refused
 * afterwards anyway (openVideo denies canceled meetings). A missing room is
 * not an error; other failures are retried.
 */
final class CloseMeetingRooms implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [10, 60];

    public function __construct(public readonly string $meetingId) {}

    public function handle(VideoRooms $rooms, LiveKitRoomService $service, MeetingOccurrences $occurrences): int
    {
        $meeting = Meeting::query()->withTrashed()->find($this->meetingId);

        if ($meeting === null || $meeting->platform !== MeetingPlatform::Video || ! $rooms->configured()) {
            return 0;
        }

        $names = MeetingAttendance::query()
            ->where('meeting_id', $meeting->id)
            ->whereNull('left_at')
            ->distinct()
            ->pluck('room')
            ->all();
        $names[] = $rooms->roomName($occurrences->resolve($meeting, null));
        $closed = 0;

        foreach (array_values(array_unique(array_map(strval(...), $names))) as $room) {
            try {
                $service->deleteRoom($room);
                $closed++;
            } catch (RuntimeException $exception) {
                if (! str_contains($exception->getMessage(), 'not_found') && ! str_contains($exception->getMessage(), '404')) {
                    throw $exception;
                }

                Log::info('meetings.video_room_already_closed', ['meeting_id' => $meeting->id, 'room' => $room]);
            }
        }

        return $closed;
    }
}
