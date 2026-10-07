<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Models\MeetingAttendance;
use Carbon\CarbonImmutable;

/**
 * "Hadir di rapat video" of one occurrence (meeting_attendances, one query):
 * per person the first join, the last leave (null while still in the room),
 * the total time over all sessions (an open session counts until now) and
 * whether they are in the room right now.
 */
final class VideoAttendance
{
    /**
     * @return list<array{user_id: string, joined_at: string, left_at: string|null, duration_seconds: int, in_room: bool, sessions: int}>
     */
    public function forOccurrence(Occurrence $occurrence, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $people = [];

        $rows = MeetingAttendance::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->whereDate('occurrence_date', $occurrence->date)
            ->whereNotNull('user_id')
            ->orderBy('joined_at')
            ->get(['user_id', 'joined_at', 'left_at', 'duration_seconds']);

        foreach ($rows as $row) {
            $id = (string) $row->user_id;
            $open = $row->left_at === null;
            $seconds = $open ? max(0, (int) $row->joined_at->diffInSeconds($now)) : (int) $row->duration_seconds;
            $person = $people[$id] ?? [
                'user_id' => $id,
                'joined_at' => $row->joined_at->toIso8601ZuluString(),
                'left_at' => null,
                'duration_seconds' => 0,
                'in_room' => false,
                'sessions' => 0,
                'last_left' => null,
            ];

            $person['duration_seconds'] += $seconds;
            $person['sessions']++;
            $person['in_room'] = $person['in_room'] || $open;

            if (! $open && ($person['last_left'] === null || $row->left_at->gt($person['last_left']))) {
                $person['last_left'] = $row->left_at;
            }

            $people[$id] = $person;
        }

        return array_values(array_map(function (array $person): array {
            $last = $person['last_left'];
            unset($person['last_left']);
            $person['left_at'] = $person['in_room'] || ! $last instanceof CarbonImmutable ? null : $last->toIso8601ZuluString();

            return $person;
        }, $people));
    }

    /**
     * Employees who were in the video room of the occurrence at least once.
     *
     * @return list<string>
     */
    public function attendedUserIds(Occurrence $occurrence): array
    {
        $ids = MeetingAttendance::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->whereDate('occurrence_date', $occurrence->date)
            ->whereNotNull('user_id')
            ->distinct()
            ->pluck('user_id')
            ->all();

        return array_values(array_map(fn (mixed $id): string => (string) $id, $ids));
    }
}
