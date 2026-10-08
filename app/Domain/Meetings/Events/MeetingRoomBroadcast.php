<?php

namespace App\Domain\Meetings\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Event of the video meeting room on the private channel `meeting.{id}`
 * (audience = MeetingPolicy::openVideo, routes/channels.php). One channel per
 * meeting/series: every payload carries `occurrence_date`. Names and payloads
 * are listed in docs/fitur/rapat-video-kontrak.md §5 (speaking.updated,
 * participant.called, minutes.source_chosen, minutes.updated,
 * attendance.updated). Payloads hold ids and totals only, never minutes text:
 * clients refetch through the authorized JSON endpoints. Sent after commit on
 * the `realtime` queue.
 */
final class MeetingRoomBroadcast implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly string $meetingId,
        public readonly string $name,
        public readonly array $payload,
    ) {}

    public function broadcastQueue(): string
    {
        return 'realtime';
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('meeting.'.$this->meetingId)];
    }

    public function broadcastAs(): string
    {
        return $this->name;
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
