<?php

namespace Database\Factories;

use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use App\Models\Meeting;
use App\Models\MeetingTranscript;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MeetingTranscript>
 */
class MeetingTranscriptFactory extends Factory
{
    protected $model = MeetingTranscript::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'meeting_id' => Meeting::factory(),
            'occurrence_date' => '2026-10-05',
            'room' => fn (array $attributes): string => 'rk-'.strtolower((string) $attributes['meeting_id']).'-'.str_replace('-', '', (string) $attributes['occurrence_date']),
            'status' => TranscriptStatus::Recording,
            'segments' => [],
            'sessions' => [],
            'started_at' => CarbonImmutable::parse('2026-10-05 03:00:00'),
        ];
    }

    /**
     * Ready transcript of the given lines: [identity, name, start seconds, text].
     *
     * @param  list<array{0: string, 1: string, 2: int, 3: string}>  $lines
     */
    public function ready(array $lines = [], ?array $draft = null): static
    {
        return $this->state(fn (): array => [
            'status' => TranscriptStatus::Ready,
            'language' => 'id',
            'model' => 'faster-whisper/large-v3-turbo',
            'duration_seconds' => $lines === [] ? 0 : max(array_map(fn (array $line): int => $line[2] + 5, $lines)),
            'segments' => array_map(fn (array $line): array => [
                'speaker_identity' => $line[0],
                'user_id' => preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/i', $line[0]) === 1 ? $line[0] : null,
                'speaker_name' => $line[1],
                'start_ms' => $line[2] * 1000,
                'end_ms' => $line[2] * 1000 + 4000,
                'text' => $line[3],
            ], $lines),
            'draft' => $draft,
            'draft_status' => $draft !== null ? DraftStatus::Ready : null,
            'purge_after' => CarbonImmutable::now()->addDays(90),
        ]);
    }
}
