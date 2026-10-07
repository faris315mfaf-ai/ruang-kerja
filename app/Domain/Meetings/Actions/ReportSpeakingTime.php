<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\SpeakingTimes;
use App\Domain\Meetings\Services\RoomEvents;
use App\Models\MeetingAttendance;
use App\Models\MeetingSpeakingTime;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * A participant reports their OWN accumulated speaking time in the video
 * room of an occurrence (POST /rapat/{id}/video/bicara, every ~15 s). The
 * stored value never decreases and cannot run ahead of the clock:
 *
 * - at most (now − first join from the LiveKit webhook) + SLACK_MS;
 * - at most stored + (now − last report) + SLACK_MS;
 * - a first report without webhook data at most FIRST_REPORT_MAX_MS;
 * - reports less than MIN_INTERVAL_SECONDS after the previous one are ignored.
 *
 * Larger values are clipped, never rejected. Returns the accepted total.
 * Accepted changes broadcast `speaking.updated` (throttled, RoomEvents).
 */
final class ReportSpeakingTime
{
    public const int SLACK_MS = 5_000;

    public const int FIRST_REPORT_MAX_MS = 60_000;

    public const int MIN_INTERVAL_SECONDS = 3;

    public const int MAX_MS = 86_400_000;

    public function __construct(
        private readonly SpeakingTimes $speaking,
        private readonly RoomEvents $events,
    ) {}

    public function handle(Occurrence $occurrence, User $user, int $reportedMs, ?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now();
        $reported = max(0, min($reportedMs, self::MAX_MS));
        $meetingId = $occurrence->meeting->id;

        [$accepted, $changed] = DB::transaction(function () use ($occurrence, $user, $reported, $now, $meetingId): array {
            $query = MeetingSpeakingTime::query()
                ->where('meeting_id', $meetingId)
                ->where('occurrence_date', $occurrence->date)
                ->where('user_id', $user->id);

            $row = (clone $query)->lockForUpdate()->first();

            if ($row === null) {
                MeetingSpeakingTime::query()->insertOrIgnore([
                    'id' => (string) str()->ulid(),
                    'meeting_id' => $meetingId,
                    'occurrence_date' => $occurrence->date,
                    'user_id' => $user->id,
                    'ms_spoken' => 0,
                    'created_at' => $now,
                    'updated_at' => null,
                ]);
                $row = $query->lockForUpdate()->firstOrFail();
            }

            $stored = $row->ms_spoken;
            $last = $row->updated_at;

            if ($last !== null && $last->gt($now->subSeconds(self::MIN_INTERVAL_SECONDS))) {
                return [$stored, false];
            }

            $cap = $last !== null
                ? $stored + max(0, (int) $last->diffInMilliseconds($now)) + self::SLACK_MS
                : self::FIRST_REPORT_MAX_MS;

            $joinedAt = MeetingAttendance::query()
                ->where('meeting_id', $meetingId)
                ->where('occurrence_date', $occurrence->date)
                ->where('user_id', $user->id)
                ->min('joined_at');

            if ($joinedAt !== null) {
                $sinceJoin = max(0, (int) CarbonImmutable::parse((string) $joinedAt)->diffInMilliseconds($now)) + self::SLACK_MS;
                $cap = $last !== null ? min($cap, $sinceJoin) : $sinceJoin;
            }

            $accepted = max($stored, min($reported, $cap));

            // Every accepted report touches the row (heartbeat: "in the room, 0 ms" counts as silent).
            $row->forceFill(['ms_spoken' => $accepted, 'updated_at' => $now])->save();

            return [$accepted, $accepted !== $stored || $last === null];
        });

        if ($changed) {
            $this->events->speakingUpdated($occurrence, fn (): array => $this->speaking->totals($occurrence));
        }

        return $accepted;
    }
}
