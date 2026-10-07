<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Models\MeetingMinutes;

/**
 * Minutes of one occurrence: read without creating, or open (create the row
 * with a blank draft — agenda items as empty sections, attendance from the
 * participants who did not decline — and lock it for the caller's
 * transaction). For a video meeting whose room was used, the blank draft's
 * attendance comes from who actually joined (meeting_attendances).
 */
final class MinutesStore
{
    public function find(Occurrence $occurrence): ?MeetingMinutes
    {
        return MeetingMinutes::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->whereDate('occurrence_date', $occurrence->date)
            ->first();
    }

    /**
     * Must run inside a transaction: the row stays locked until commit.
     */
    public function open(Occurrence $occurrence): MeetingMinutes
    {
        $query = MeetingMinutes::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->whereDate('occurrence_date', $occurrence->date);

        $minutes = (clone $query)->lockForUpdate()->first();

        if ($minutes !== null) {
            return $minutes;
        }

        $blank = $this->blank($occurrence);

        MeetingMinutes::query()->insertOrIgnore([
            'id' => (string) str()->ulid(),
            'meeting_id' => $occurrence->meeting->id,
            'occurrence_date' => $occurrence->date,
            'status' => 'draft',
            'attendance' => json_encode($blank['attendance'], JSON_THROW_ON_ERROR),
            'sections' => json_encode($blank['sections'], JSON_THROW_ON_ERROR),
            'decisions' => '[]',
            'version' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $query->lockForUpdate()->firstOrFail();
    }

    /**
     * Draft content before anything was written.
     *
     * @return array{attendance: list<array{user_id: string, present: bool}>, sections: list<array{title: string, body: string}>, decisions: list<string>}
     */
    public function blank(Occurrence $occurrence): array
    {
        $meeting = $occurrence->meeting;
        $meeting->loadMissing('participants');

        $attendance = array_values($meeting->participants
            ->filter(fn ($participant): bool => $participant->user_id !== null && $participant->rsvp !== Rsvp::No)
            ->map(fn ($participant): array => ['user_id' => (string) $participant->user_id, 'present' => true])
            ->all());

        $joined = $meeting->platform === MeetingPlatform::Video
            ? app(VideoAttendance::class)->attendedUserIds($occurrence)
            : [];

        if ($joined !== []) {
            // Everyone invited, marked present when they were in the video room.
            $attendance = array_values($meeting->participants
                ->filter(fn ($participant): bool => $participant->user_id !== null)
                ->map(fn ($participant): array => ['user_id' => (string) $participant->user_id, 'present' => in_array((string) $participant->user_id, $joined, true)])
                ->all());
        }

        $sections = array_map(fn (string $title): array => ['title' => $title, 'body' => ''], $meeting->agenda);

        return ['attendance' => $attendance, 'sections' => $sections, 'decisions' => []];
    }
}
