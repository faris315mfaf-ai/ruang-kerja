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
 * - at most the time actually spent in the room (LiveKit webhook sessions,
 *   an open session counting until now) + SLACK_MS — leaving the room stops
 *   the clock (audit rapat 2026-10, B-01);
 * - at most stored + (now − last report) + SLACK_MS;
 * - without webhook data (not seen in the room yet) at most
 *   FIRST_REPORT_MAX_MS in total, however often it reports (B-01);
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

            $inRoom = $this->inRoomMilliseconds($meetingId, $occurrence->date, $user->id, $now);

            $cap = $inRoom === null
                ? min($cap, self::FIRST_REPORT_MAX_MS)
                : ($last !== null ? min($cap, $inRoom + self::SLACK_MS) : $inRoom + self::SLACK_MS);

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

    /**
     * Total time in the room from the LiveKit webhook sessions (an open one
     * counts until now), or null when the person was never seen there.
     */
    private function inRoomMilliseconds(string $meetingId, string $date, string $userId, CarbonImmutable $now): ?int
    {
        $sessions = MeetingAttendance::query()
            ->where('meeting_id', $meetingId)
            ->where('occurrence_date', $date)
            ->where('user_id', $userId)
            ->get(['joined_at', 'left_at']);

        if ($sessions->isEmpty()) {
            return null;
        }

        $total = (int) $sessions->sum(fn (MeetingAttendance $session): int => max(0, (int) $session->joined_at->diffInMilliseconds($session->left_at ?? $now)));
        // Overlapping sessions (two tabs) never count more than the wall clock since the first join.
        $first = $sessions->min('joined_at');

        return $first instanceof CarbonImmutable ? min($total, max(0, (int) $first->diffInMilliseconds($now))) : $total;
    }
}
