<?php

namespace App\Http\Resources\Meetings;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;

/**
 * `video` prop of the meeting detail, pre-join and room pages
 * (resources/js/features/meetings/video/types.ts VideoSummary): whether the
 * server is configured, the join window, links, and who joined (webhooks).
 */
final class VideoPresenter
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly VideoAttendance $attendance,
        private readonly MeetingPolicy $policy,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function summary(Occurrence $occurrence, User $viewer, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $meeting = $occurrence->meeting;
        $attendance = $this->attendance->forOccurrence($occurrence, $now);
        $open = $this->policy->openVideo($viewer, $meeting);

        return [
            'configured' => $this->rooms->configured(),
            'join_href' => $occurrence->url('/gabung'),
            'room_href' => $occurrence->url('/ruang'),
            'token_url' => '/rapat/'.$meeting->id.'/video/token',
            'opens_at' => $this->rooms->opensAt($occurrence)->toIso8601ZuluString(),
            'closes_at' => $this->rooms->closesAt($occurrence)->toIso8601ZuluString(),
            'is_organizer' => $meeting->organizer_id === $viewer->id,
            'can_join' => $open->allowed(),
            'denied_reason' => $open->allowed() ? null : $open->message(),
            'attendance' => $attendance,
            'in_room' => count(array_filter($attendance, fn (array $person): bool => $person['in_room'])),
        ];
    }
}
