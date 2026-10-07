<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Events\MeetingRoomBroadcast;
use App\Models\Meeting;
use App\Models\MeetingMinutes;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * Sends the video room events (MeetingRoomBroadcast on `meeting.{id}`,
 * docs/fitur/rapat-video-kontrak.md §5). Only meetings on the built-in video
 * platform have a room channel; other meetings send nothing.
 * `speaking.updated` is throttled to one per occurrence per
 * SPEAKING_THROTTLE_SECONDS (clients report every 15 s each).
 */
final class RoomEvents
{
    public const int SPEAKING_THROTTLE_SECONDS = 5;

    /** Whether a real broadcaster is configured (else clients poll). */
    public static function realtime(): bool
    {
        return ! in_array((string) config('broadcasting.default'), ['', 'null', 'log'], true);
    }

    /**
     * Minutes saved, finalized, reopened, or a follow-up changed.
     */
    public function minutesChanged(MeetingMinutes $minutes, ?Meeting $meeting = null): void
    {
        $meeting ??= $minutes->relationLoaded('meeting') ? $minutes->meeting : null;
        $platform = $meeting !== null
            ? $meeting->platform
            : Meeting::query()->withTrashed()->whereKey($minutes->meeting_id)->value('platform');

        if ($platform !== MeetingPlatform::Video && $platform !== MeetingPlatform::Video->value) {
            return;
        }

        $this->send($minutes->meeting_id, 'minutes.updated', [
            'occurrence_date' => $minutes->occurrence_date->toDateString(),
            'minutes_id' => $minutes->id,
            'version' => $minutes->version,
            'saved_at' => $minutes->updated_at?->toIso8601ZuluString(),
            'updated_by' => $minutes->updated_by,
            'status' => $minutes->status->value,
        ]);
    }

    public function sourceChosen(Occurrence $occurrence, MeetingMinutes $minutes): void
    {
        if (! $this->isVideo($occurrence->meeting) || $minutes->notes_source === null) {
            return;
        }

        $this->send($occurrence->meeting->id, 'minutes.source_chosen', [
            'occurrence_date' => $occurrence->date,
            'source' => $minutes->notes_source->value,
            'chosen_by' => $minutes->notes_source_by,
            'chosen_at' => $minutes->notes_source_at?->toIso8601ZuluString(),
        ]);
    }

    /**
     * @param  callable(): array<string, mixed>  $totals  computed only when the event is sent
     */
    public function speakingUpdated(Occurrence $occurrence, callable $totals): bool
    {
        if (! $this->isVideo($occurrence->meeting)) {
            return false;
        }

        $key = 'meeting-room:speaking:'.$occurrence->meeting->id.':'.$occurrence->date;

        if (! Cache::add($key, true, self::SPEAKING_THROTTLE_SECONDS)) {
            return false;
        }

        $this->send($occurrence->meeting->id, 'speaking.updated', [
            'occurrence_date' => $occurrence->date,
            'totals' => $totals(),
        ]);

        return true;
    }

    public function participantCalled(Occurrence $occurrence, string $userId, string $calledBy, CarbonImmutable $at): void
    {
        $this->send($occurrence->meeting->id, 'participant.called', [
            'occurrence_date' => $occurrence->date,
            'user_id' => $userId,
            'called_by' => $calledBy,
            'called_at' => $at->toIso8601ZuluString(),
        ]);
    }

    /**
     * "X sedang menyunting" (minutes without collaboration); null = released.
     *
     * @param  array{user_id: string, name: string, since: string, expires_at: string}|null  $holder
     */
    public function minutesEditing(Occurrence $occurrence, ?array $holder): void
    {
        if (! $this->isVideo($occurrence->meeting)) {
            return;
        }

        $this->send($occurrence->meeting->id, 'minutes.editing', [
            'occurrence_date' => $occurrence->date,
            'editing' => $holder,
        ]);
    }

    /**
     * @param  'joined'|'left'|'finished'  $event
     */
    public function attendanceUpdated(Meeting $meeting, string $date, ?string $userId, string $event): void
    {
        if (! $this->isVideo($meeting)) {
            return;
        }

        $this->send($meeting->id, 'attendance.updated', [
            'occurrence_date' => $date,
            'user_id' => $userId,
            'event' => $event,
        ]);
    }

    private function isVideo(Meeting $meeting): bool
    {
        return $meeting->platform === MeetingPlatform::Video;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function send(string $meetingId, string $name, array $payload): void
    {
        MeetingRoomBroadcast::dispatch($meetingId, $name, $payload);
    }
}
