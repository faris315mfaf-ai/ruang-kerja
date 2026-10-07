<?php

namespace App\Http\Resources\Meetings;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Services\MeetingCalls;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;

/**
 * `video` prop of the meeting detail, pre-join and room pages
 * (resources/js/features/meetings/video/types.ts VideoSummary, extended in
 * resources/js/types/meetings-room.ts RoomVideoSummary): whether the server
 * is configured, the join window, links, who joined (webhooks; late badge)
 * and who did not join yet (with the last "Panggil").
 */
final class VideoPresenter
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly VideoAttendance $attendance,
        private readonly MeetingPolicy $policy,
        private readonly MeetingCalls $calls,
    ) {}

    /**
     * @param  array{attendance: list<array<string, mixed>>, not_joined: list<array{user_id: string, rsvp: string, optional: bool}>, in_room: int}|null  $roster  VideoAttendance::roster() when already loaded
     * @return array<string, mixed>
     */
    public function summary(Occurrence $occurrence, User $viewer, ?CarbonImmutable $now = null, ?array $roster = null): array
    {
        $now ??= CarbonImmutable::now();
        $meeting = $occurrence->meeting;
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
            ...$this->attendance($occurrence, $roster ?? $this->attendance->roster($occurrence, $now)),
        ];
    }

    /**
     * Kehadiran panel (GET /rapat/{id}/video/kehadiran and the `video` prop).
     *
     * @param  array{attendance: list<array<string, mixed>>, not_joined: list<array{user_id: string, rsvp: string, optional: bool}>, in_room: int}  $roster
     * @return array{attendance: list<array<string, mixed>>, in_room: int, not_joined: list<array<string, mixed>>, late_grace_minutes: int, removed: list<array<string, mixed>>}
     */
    public function attendance(Occurrence $occurrence, array $roster): array
    {
        $called = $this->calls->lastCalls($occurrence, array_column($roster['not_joined'], 'user_id'));

        return [
            'attendance' => $roster['attendance'],
            'in_room' => $roster['in_room'],
            'not_joined' => array_map(fn (array $person): array => [
                ...$person,
                'called_at' => $called[$person['user_id']] ?? null,
            ], $roster['not_joined']),
            'late_grace_minutes' => VideoAttendance::LATE_GRACE_MINUTES,
            // Removed by the organizer: no new token until "Izinkan masuk lagi" (audit R-04).
            'removed' => array_values(MeetingVideoRemoval::query()
                ->where('meeting_id', $occurrence->meeting->id)
                ->where('occurrence_date', $occurrence->date)
                ->orderBy('created_at')
                ->get(['user_id', 'removed_by', 'created_at'])
                ->map(fn (MeetingVideoRemoval $removal): array => [
                    'user_id' => $removal->user_id,
                    'removed_by' => $removal->removed_by,
                    'removed_at' => $removal->created_at?->toIso8601ZuluString(),
                ])
                ->all()),
        ];
    }
}
