<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Attendance from a verified LiveKit webhook event (LiveKitWebhookController):
 *
 * - participant_joined → a row per participant session (SID), idempotent;
 * - participant_left → closes that row (left_at, duration); a missed "joined"
 *   is recreated from the participant's joinedAt;
 * - room_finished → closes every open row of the room.
 *
 * Rooms that do not map to a video meeting occurrence ("rk-{id}-{yyyymmdd}")
 * are ignored, and so is every identity that is not the ULID of an employee
 * of the meeting's company — including the hidden transcription agent
 * (AGENT_IDENTITY, docs/fitur/notulen-otomatis-kontrak.md §3): no row. Returns whether
 * anything was recorded; recorded events are broadcast as
 * `attendance.updated` on `meeting.{id}` (the Kehadiran panel refetches).
 */
final class RecordVideoEvent
{
    /** LiveKit identity of the automatic minutes worker (not a person). */
    public const string AGENT_IDENTITY = 'rk-notulen';

    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly MeetingOccurrences $occurrences,
        private readonly RoomEvents $events,
    ) {}

    /**
     * @param  array<string, mixed>  $event  decoded webhook body
     */
    public function handle(array $event): bool
    {
        $type = is_string($event['event'] ?? null) ? $event['event'] : '';
        $room = self::map($event['room'] ?? null);
        $roomName = is_string($room['name'] ?? null) ? $room['name'] : '';
        $target = $this->rooms->parseRoom($roomName);

        if ($target === null || ! in_array($type, ['participant_joined', 'participant_left', 'room_finished'], true)) {
            return false;
        }

        $meeting = Meeting::query()->find($target['meeting_id']);

        if ($meeting === null || $meeting->platform !== MeetingPlatform::Video || ! $this->occurrences->meetsOn($meeting, $target['date'])) {
            return false;
        }

        $at = self::timestamp($event['createdAt'] ?? $event['created_at'] ?? null) ?? CarbonImmutable::now();

        if ($type === 'room_finished') {
            $finished = $this->finishRoom($roomName, $at) > 0;

            if ($finished) {
                $this->events->attendanceUpdated($meeting, $target['date'], null, 'finished');
            }

            return $finished;
        }

        $participant = self::map($event['participant'] ?? null);

        $sid = is_string($participant['sid'] ?? null) ? $participant['sid'] : '';

        if ($sid === '' || strlen($sid) > 64) {
            return false;
        }

        $joinedAt = self::timestamp($participant['joinedAtMs'] ?? null, milliseconds: true)
            ?? self::timestamp($participant['joinedAt'] ?? $participant['joined_at'] ?? null)
            ?? $at;
        $userId = $this->userId($meeting, $participant['identity'] ?? null);

        // Only employees of the meeting's company are attendance: the hidden
        // transcription agent (AGENT_IDENTITY), guests and foreign ids are not stored.
        if ($userId === null) {
            return false;
        }

        DB::transaction(function () use ($type, $meeting, $target, $roomName, $sid, $joinedAt, $userId, $at): void {
            // insertOrIgnore + refetch (MinutesStore::open pattern): two
            // concurrent "joined" webhooks with the same SID would otherwise
            // race past a lock on a row that does not exist yet.
            MeetingAttendance::query()->insertOrIgnore([
                'id' => (string) str()->ulid(),
                'meeting_id' => $meeting->id,
                'occurrence_date' => $target['date'],
                'user_id' => $userId,
                'room' => $roomName,
                'participant_sid' => $sid,
                'joined_at' => $joinedAt,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $row = MeetingAttendance::query()->where('participant_sid', $sid)->lockForUpdate()->firstOrFail();

            if ($type === 'participant_left' && $row->left_at === null) {
                $left = $at->lt($row->joined_at) ? $row->joined_at : $at;
                $row->forceFill([
                    'left_at' => $left,
                    'duration_seconds' => (int) $row->joined_at->diffInSeconds($left),
                ])->save();
            }

        });

        $this->events->attendanceUpdated($meeting, $target['date'], $userId, $type === 'participant_left' ? 'left' : 'joined');

        return true;
    }

    private function finishRoom(string $room, CarbonImmutable $at): int
    {
        $closed = 0;

        MeetingAttendance::query()->where('room', $room)->whereNull('left_at')->get()
            ->each(function (MeetingAttendance $row) use ($at, &$closed): void {
                $left = $at->lt($row->joined_at) ? $row->joined_at : $at;
                $row->forceFill(['left_at' => $left, 'duration_seconds' => (int) $row->joined_at->diffInSeconds($left)])->save();
                $closed++;
            });

        return $closed;
    }

    private function userId(Meeting $meeting, mixed $identity): ?string
    {
        if (! is_string($identity) || preg_match('/^[0-9a-hjkmnp-tv-z]{26}$/', $identity) !== 1) {
            return null;
        }

        return User::query()->whereKey($identity)->where('company_id', $meeting->company_id)->value('id');
    }

    /**
     * @return array<string, mixed>
     */
    private static function map(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }

    /** protojson int64 seconds (string or int), or milliseconds. */
    private static function timestamp(mixed $value, bool $milliseconds = false): ?CarbonImmutable
    {
        if (! is_numeric($value) || (int) $value <= 0) {
            return null;
        }

        $seconds = $milliseconds ? intdiv((int) $value, 1000) : (int) $value;

        return CarbonImmutable::createFromTimestampUTC($seconds);
    }
}
