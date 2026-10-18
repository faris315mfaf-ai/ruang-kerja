<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Guests\Actions\IssueGuestVideoToken;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use App\Domain\Meetings\Transcripts\Jobs\SummarizeMeetingTranscript;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Meetings\Transcripts\Services\TranscriptConsents;
use App\Domain\Tenancy\CompanyContext;
use App\Models\Meeting;
use App\Models\MeetingTranscript;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * A verified message from the transcriber worker (POST /api/notulen/transcript):
 *
 * - `recording` / `transcribing` → the occurrence's transcript row shows it;
 * - `ready` → segments are cleaned, people who opted out and external guests
 *   (`guest:*`, never recorded) are dropped (second line of defence after the worker), offsets are rebased onto the
 *   transcript's first start (a room may be recorded in several sessions),
 *   then merged by time; the AI draft is queued (or `disabled` without an
 *   API key). A session id is merged only once (worker retries are safe).
 * - `failed` → error shown; earlier parts stay readable.
 *
 * Meetings that are not video meetings with auto_minutes are ignored.
 * Returns "recorded" or "ignored".
 */
final class RecordTranscriptUpdate
{
    public const int MAX_SEGMENTS = 20000;

    public const string GUEST_NAME = 'Peserta tamu';

    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly MeetingOccurrences $occurrences,
        private readonly NotulenConfig $config,
        private readonly TranscriptConsents $consents,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handle(array $payload): string
    {
        $room = is_string($payload['room'] ?? null) ? $payload['room'] : '';
        $target = $this->rooms->parseRoom($room);
        $status = TranscriptStatus::tryFrom(is_string($payload['status'] ?? null) ? $payload['status'] : '');
        $meeting = $target !== null ? Meeting::query()->find($target['meeting_id']) : null;
        // Server-to-server ingest: run in the meeting's company (Fase 1 CompanyContext).
        app(CompanyContext::class)->set($meeting?->company_id);

        if ($target === null || $status === null || $status === TranscriptStatus::Summarizing || $meeting === null
            || $meeting->platform !== MeetingPlatform::Video || ! NotulenConfig::autoMinutes($meeting)
            || ! $this->occurrences->meetsOn($meeting, $target['date'])) {
            return 'ignored';
        }

        $session = is_string($payload['session'] ?? null) ? mb_substr($payload['session'], 0, 64) : '';
        $startedAt = self::time($payload['started_at'] ?? null);

        if ($session === '' && $status === TranscriptStatus::Ready) {
            // No session id: a deterministic key of the content keeps a resend idempotent (audit T-10).
            $session = 'h-'.substr(hash('sha256', (string) json_encode([$room, $payload['started_at'] ?? null, $payload['segments'] ?? []])), 0, 40);
        }
        $summarize = false;

        DB::transaction(function () use ($meeting, $target, $room, $status, $payload, $session, $startedAt, &$summarize): void {
            MeetingTranscript::query()->insertOrIgnore([
                'id' => (string) str()->ulid(),
                'meeting_id' => $meeting->id,
                'occurrence_date' => $target['date'],
                'room' => $room,
                'status' => TranscriptStatus::Recording->value,
                'segments' => '[]',
                'sessions' => '[]',
                'started_at' => $startedAt,
                // A recording that never completes still ages out.
                'purge_after' => CarbonImmutable::now()->addDays($this->config->retentionDays()),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            /** @var MeetingTranscript $transcript */
            $transcript = MeetingTranscript::query()->forOccurrence($meeting->id, $target['date'])->lockForUpdate()->firstOrFail();

            if ($session !== '' && in_array($session, $transcript->sessions, true)) {
                return; // this part was merged already
            }

            // Progress messages never undo a finished transcript (late or reordered
            // retries, audit T-10); a new part still merges when its "ready" arrives.
            $terminal = in_array($transcript->status, [TranscriptStatus::Ready, TranscriptStatus::Summarizing, TranscriptStatus::Failed], true);

            match ($status) {
                TranscriptStatus::Ready => $summarize = $this->merge($transcript, $meeting, $payload, $session, $startedAt),
                TranscriptStatus::Failed => $this->fail($transcript, $payload),
                default => $terminal ? null : $transcript->forceFill(['status' => $status, 'error' => null])->save(),
            };
        });

        if ($summarize) {
            SummarizeMeetingTranscript::dispatch($meeting->id, $target['date'])->afterCommit();
        }

        return 'recorded';
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function merge(MeetingTranscript $transcript, Meeting $meeting, array $payload, string $session, ?CarbonImmutable $startedAt): bool
    {
        $base = $transcript->started_at;
        $existing = $transcript->segments;

        // Rebase everything onto the earliest start.
        if ($startedAt !== null && ($base === null || $startedAt->lt($base))) {
            $shift = $base !== null ? (int) $startedAt->diffInMilliseconds($base) : 0;
            $existing = array_map(fn (array $s): array => [...$s, 'start_ms' => $s['start_ms'] + $shift, 'end_ms' => $s['end_ms'] + $shift], $existing);
            $base = $startedAt;
        }

        $offset = $startedAt !== null && $base !== null ? (int) $base->diffInMilliseconds($startedAt) : 0;
        $incoming = $this->clean($meeting, is_array($payload['segments'] ?? null) ? $payload['segments'] : [], $offset);
        $segments = [...$existing, ...$incoming];
        usort($segments, fn (array $a, array $b): int => [$a['start_ms'], $a['end_ms']] <=> [$b['start_ms'], $b['end_ms']]);
        $segments = array_slice($segments, 0, self::MAX_SEGMENTS);

        $language = is_string($payload['language'] ?? null) ? mb_substr($payload['language'], 0, 8) : $transcript->language;
        $model = is_string($payload['model'] ?? null) ? mb_substr($payload['model'], 0, 80) : $transcript->model;
        $draftDone = in_array($transcript->draft_status, [DraftStatus::Inserted, DraftStatus::Discarded], true);
        $summarize = ! $draftDone && $this->config->llmEnabled() && $segments !== [];

        $transcript->forceFill([
            'segments' => $segments,
            'sessions' => [...$transcript->sessions, ...($session !== '' ? [$session] : [])],
            'started_at' => $base,
            'ended_at' => self::time($payload['ended_at'] ?? null) ?? CarbonImmutable::now(),
            'duration_seconds' => intdiv(max([0, ...array_map(fn (array $s): int => $s['end_ms'], $segments)]), 1000),
            'language' => $language,
            'model' => $model,
            'error' => null,
            'status' => $summarize ? TranscriptStatus::Summarizing : TranscriptStatus::Ready,
            'draft_status' => $draftDone ? $transcript->draft_status : ($summarize ? DraftStatus::Pending : DraftStatus::Disabled),
            'draft_error' => null,
            'purge_after' => CarbonImmutable::now()->addDays($this->config->retentionDays()),
        ])->save();

        return $summarize;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function fail(MeetingTranscript $transcript, array $payload): void
    {
        $error = is_string($payload['error'] ?? null) && $payload['error'] !== '' ? mb_substr($payload['error'], 0, 300) : 'Transkripsi gagal.';

        $transcript->forceFill([
            // Earlier parts stay usable.
            'status' => $transcript->segments !== [] ? TranscriptStatus::Ready : TranscriptStatus::Failed,
            'error' => $error,
            'purge_after' => $transcript->purge_after ?? CarbonImmutable::now()->addDays($this->config->retentionDays()),
        ])->save();
    }

    /**
     * @param  array<mixed>  $raw
     * @return list<array{speaker_identity: string, user_id: string|null, speaker_name: string, start_ms: int, end_ms: int, text: string}>
     */
    private function clean(Meeting $meeting, array $raw, int $offset): array
    {
        $identities = [];

        foreach ($raw as $segment) {
            if (is_array($segment) && is_string($segment['speaker_identity'] ?? null)) {
                $identities[] = $segment['speaker_identity'];
            }
        }

        $ulids = array_values(array_unique(array_filter($identities, fn (string $id): bool => preg_match('/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/', $id) === 1)));
        $names = User::query()->where('company_id', $meeting->company_id)->whereIn('id', $ulids)->pluck('name', 'id')->all();
        $optedOut = array_flip($this->consents->optedOutIds($meeting));
        $clean = [];

        foreach (array_slice($raw, 0, self::MAX_SEGMENTS) as $segment) {
            if (! is_array($segment) || ! is_string($segment['text'] ?? null) || ! is_numeric($segment['start_ms'] ?? null)) {
                continue;
            }

            $identity = is_string($segment['speaker_identity'] ?? null) ? mb_substr($segment['speaker_identity'], 0, 64) : '';
            $userId = isset($names[$identity]) ? $identity : null;

            // External guests (identity `guest:*`) never consented to a transcript: dropped
            // here as a second line of defence after the worker, which never records them.
            if ($identity === '' || isset($optedOut[$identity]) || str_starts_with($identity, IssueGuestVideoToken::IDENTITY_PREFIX)) {
                continue;
            }

            $text = trim((string) preg_replace('/\s+/u', ' ', $segment['text']));

            if ($text === '') {
                continue;
            }

            $start = max(0, (int) $segment['start_ms']) + $offset;
            $end = max($start, (is_numeric($segment['end_ms'] ?? null) ? (int) $segment['end_ms'] : 0) + $offset);
            // Display names come from users.name only: a LiveKit participant can rename
            // themselves, so the worker's speaker_name is never trusted (audit N-01).
            $name = $userId !== null ? (string) $names[$userId] : self::GUEST_NAME;

            $clean[] = [
                'speaker_identity' => $identity,
                'user_id' => $userId,
                'speaker_name' => mb_substr($name, 0, 120),
                'start_ms' => $start,
                'end_ms' => $end,
                'text' => mb_substr($text, 0, 2000),
            ];
        }

        return $clean;
    }

    private static function time(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->utc();
        } catch (Throwable) {
            return null;
        }
    }
}
