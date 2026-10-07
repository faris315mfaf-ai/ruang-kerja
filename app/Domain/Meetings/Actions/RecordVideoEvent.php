<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Services\MeetingOccurrences;
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
 * and identities that are not employees of the meeting's company are
 * ignored. Returns whether anything was recorded.
 */
final class RecordVideoEvent
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly MeetingOccurrences $occurrences,
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
            return $this->finishRoom($roomName, $at) > 0;
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

        return DB::transaction(function () use ($type, $meeting, $target, $roomName, $sid, $joinedAt, $userId, $at): bool {
            $row = MeetingAttendance::query()->where('participant_sid', $sid)->lockForUpdate()->first()
                ?? MeetingAttendance::query()->create([
                    'meeting_id' => $meeting->id,
                    'occurrence_date' => $target['date'],
                    'user_id' => $userId,
                    'room' => $roomName,
                    'participant_sid' => $sid,
                    'joined_at' => $joinedAt,
                ]);

            if ($type === 'participant_left' && $row->left_at === null) {
                $left = $at->lt($row->joined_at) ? $row->joined_at : $at;
                $row->forceFill([
                    'left_at' => $left,
                    'duration_seconds' => (int) $row->joined_at->diffInSeconds($left),
                ])->save();
            }

            return true;
        });
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
