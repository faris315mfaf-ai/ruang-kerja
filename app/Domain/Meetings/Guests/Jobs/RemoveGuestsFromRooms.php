<?php

namespace App\Domain\Meetings\Guests\Jobs;

use App\Domain\Meetings\Guests\Actions\IssueGuestVideoToken;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Guests whose link was revoked or rotated, or who were taken off the meeting,
 * leave the live LiveKit room they are still in (their token stays valid for
 * its few minutes otherwise). The room/identity pairs are collected BEFORE the
 * rows change (forParticipants), because attendance rows lose their
 * participant_id when a guest row is deleted.
 */
final class RemoveGuestsFromRooms implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @param  list<array{room: string, identity: string}>  $targets
     */
    public function __construct(public readonly array $targets) {}

    /**
     * Queues the removal of these guests from every room they are in now.
     *
     * @param  list<string>  $participantIds
     */
    public static function forParticipants(Meeting $meeting, array $participantIds): void
    {
        if ($participantIds === [] || $meeting->platform->value !== 'video') {
            return;
        }

        $rows = MeetingAttendance::query()
            ->where('meeting_id', $meeting->id)
            ->whereIn('participant_id', $participantIds)
            ->whereNull('left_at')
            ->get(['room', 'participant_id'])
            ->map(fn (MeetingAttendance $row): array => [
                'room' => $row->room,
                'identity' => IssueGuestVideoToken::IDENTITY_PREFIX.strtolower((string) $row->participant_id),
            ])
            ->unique(fn (array $target): string => $target['room'].'|'.$target['identity'])
            ->all();
        $targets = array_values($rows);

        if ($targets !== []) {
            self::dispatch($targets)->afterCommit();
        }
    }

    public function handle(VideoRooms $rooms, LiveKitRoomService $service): void
    {
        if (! $rooms->configured()) {
            return;
        }

        foreach ($this->targets as $target) {
            try {
                $service->removeParticipant($target['room'], $target['identity']);
            } catch (RuntimeException $exception) {
                Log::warning('meetings.guest_remove_failed', ['room' => $target['room'], 'error' => $exception->getMessage()]);
            }
        }
    }
}
