<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Meetings\Transcripts\Jobs\FinishMeetingRecorder;
use App\Domain\Meetings\Transcripts\Jobs\StartMeetingRecorder;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Tenancy\CompanyContext;
use App\Models\Meeting;
use Illuminate\Support\Facades\Cache;

/**
 * Verified LiveKit webhook (second webhook URL, POST /api/notulen/livekit):
 *
 * - participant_joined of a person (not the recorder) in the room of a
 *   video meeting with auto_minutes → ask the worker to join (queued; at
 *   most once a minute per room — the worker answers "already" anyway);
 * - room_finished → ask the worker to finish and transcribe (queued).
 *
 * Returns "queued" or "ignored".
 */
final class HandleNotulenRoomEvent
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly MeetingOccurrences $occurrences,
        private readonly NotulenConfig $config,
    ) {}

    /**
     * @param  array<string, mixed>  $event
     */
    public function handle(array $event): string
    {
        $type = is_string($event['event'] ?? null) ? $event['event'] : '';
        $room = is_array($event['room'] ?? null) && is_string($event['room']['name'] ?? null) ? $event['room']['name'] : '';
        $target = $this->rooms->parseRoom($room);

        if ($target === null || ! in_array($type, ['participant_joined', 'room_finished'], true)) {
            return 'ignored';
        }

        $meeting = Meeting::query()->find($target['meeting_id']);

        // Public webhook: run in the meeting's company (Fase 1 CompanyContext).
        app(CompanyContext::class)->set($meeting?->company_id);

        if ($meeting === null || $meeting->platform !== MeetingPlatform::Video || ! NotulenConfig::autoMinutes($meeting)
            || $meeting->isCanceled() || ! $this->config->configured() || ! $this->occurrences->meetsOn($meeting, $target['date'])) {
            return 'ignored';
        }

        if ($type === 'room_finished') {
            Cache::forget('notulen:join:'.$room);
            FinishMeetingRecorder::dispatch($room);

            return 'queued';
        }

        $participant = is_array($event['participant'] ?? null) ? $event['participant'] : [];
        $identity = is_string($participant['identity'] ?? null) ? $participant['identity'] : '';

        if ($identity === '' || $identity === $this->config->identity() || ! Cache::add('notulen:join:'.$room, true, 60)) {
            return 'ignored';
        }

        StartMeetingRecorder::dispatch($meeting->id, $room);

        return 'queued';
    }
}
