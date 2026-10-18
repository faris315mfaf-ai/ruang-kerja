<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MeetingParticipants;
use App\Models\MeetingAttendance;
use Carbon\CarbonImmutable;

/**
 * "Kehadiran" of one occurrence's video room (meeting_attendances) in ONE
 * query aggregated per person: first join, last leave (null while still in
 * the room), total time over all sessions (an open session counts until
 * now), whether they are in the room now, and how late the first join was.
 * Invited employees who never joined come from the meeting's loaded
 * participants (MeetingParticipants::invited, no extra query).
 */
final class VideoAttendance
{
    /** A first join up to this many whole minutes after the start counts as on time. */
    public const int LATE_GRACE_MINUTES = 2;

    public function __construct(private readonly MeetingParticipants $participants) {}

    /**
     * @return list<array{user_id: string, joined_at: string, left_at: string|null, duration_seconds: int, in_room: bool, sessions: int, late_minutes: int, late: bool}>
     */
    public function forOccurrence(Occurrence $occurrence, ?CarbonImmutable $now = null): array
    {
        return $this->roster($occurrence, $now)['attendance'];
    }

    /**
     * Who joined (ordered by first join) and which invited employees did not.
     *
     * @return array{attendance: list<array{user_id: string, joined_at: string, left_at: string|null, duration_seconds: int, in_room: bool, sessions: int, late_minutes: int, late: bool}>, not_joined: list<array{user_id: string, rsvp: string, optional: bool}>, guests: list<array{participant_id: string, name: string, joined_at: string, left_at: string|null, duration_seconds: int, in_room: bool, sessions: int}>, in_room: int}
     */
    public function roster(Occurrence $occurrence, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $start = $occurrence->startsAt;

        $rows = MeetingAttendance::query()
            ->toBase()
            ->where('meeting_id', $occurrence->meeting->id)
            ->where('occurrence_date', $occurrence->date)
            // Employees and external guests (user_id null, participant_id set).
            ->where(fn ($who) => $who->whereNotNull('user_id')->orWhereNotNull('participant_id'))
            ->groupBy('user_id', 'participant_id')
            // Ties (same second): the session recorded first (ULIDs sort by time).
            ->orderByRaw('min(joined_at), min(id)')
            ->select('user_id', 'participant_id')
            ->selectRaw('max(guest_name) as guest_name')
            ->selectRaw('min(joined_at) as first_joined_at')
            ->selectRaw('max(left_at) as last_left_at')
            ->selectRaw('count(*) as sessions')
            ->selectRaw('count(*) filter (where left_at is null) as open_sessions')
            ->selectRaw('coalesce(sum(duration_seconds) filter (where left_at is not null), 0) as closed_seconds')
            ->selectRaw('coalesce(sum(greatest(0, floor(extract(epoch from (?::timestamptz - joined_at))))) filter (where left_at is null), 0) as open_seconds', [$now->toIso8601ZuluString()])
            ->get();

        $attendance = [];
        $guests = [];
        $joined = [];

        foreach ($rows as $row) {
            $firstJoined = CarbonImmutable::parse((string) $row->first_joined_at)->utc();
            $inRoom = (int) $row->open_sessions > 0;

            if ($row->user_id === null) {
                $guests[] = [
                    'participant_id' => (string) $row->participant_id,
                    'name' => (string) ($row->guest_name ?? 'Tamu'),
                    'joined_at' => $firstJoined->toIso8601ZuluString(),
                    'left_at' => $inRoom || $row->last_left_at === null ? null : CarbonImmutable::parse((string) $row->last_left_at)->utc()->toIso8601ZuluString(),
                    'duration_seconds' => (int) $row->closed_seconds + (int) $row->open_seconds,
                    'in_room' => $inRoom,
                    'sessions' => (int) $row->sessions,
                ];

                continue;
            }

            $id = (string) $row->user_id;
            $late = $firstJoined->gt($start) ? intdiv((int) $start->diffInSeconds($firstJoined), 60) : 0;
            $joined[$id] = true;

            $attendance[] = [
                'user_id' => $id,
                'joined_at' => $firstJoined->toIso8601ZuluString(),
                'left_at' => $inRoom || $row->last_left_at === null ? null : CarbonImmutable::parse((string) $row->last_left_at)->utc()->toIso8601ZuluString(),
                'duration_seconds' => (int) $row->closed_seconds + (int) $row->open_seconds,
                'in_room' => $inRoom,
                'sessions' => (int) $row->sessions,
                'late_minutes' => $late,
                'late' => $late > self::LATE_GRACE_MINUTES,
            ];
        }

        $notJoined = array_values(array_filter(
            $this->participants->invited($occurrence->meeting),
            fn (array $invited): bool => ! isset($joined[$invited['user_id']]),
        ));

        return [
            'attendance' => $attendance,
            'not_joined' => $notJoined,
            // External guests (label "Tamu" in the UI); not part of `in_room`, which counts employees.
            'guests' => $guests,
            'in_room' => count(array_filter($attendance, fn (array $person): bool => $person['in_room'])),
        ];
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
            ->where('occurrence_date', $occurrence->date)
            ->whereNotNull('user_id')
            ->distinct()
            ->pluck('user_id')
            ->all();

        return array_values(array_map(fn (mixed $id): string => (string) $id, $ids));
    }
}
