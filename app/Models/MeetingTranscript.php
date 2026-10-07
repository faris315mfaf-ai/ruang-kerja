<?php

namespace App\Models;

use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use Carbon\CarbonImmutable;
use Database\Factories\MeetingTranscriptFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Transcript + AI draft minutes of one video meeting occurrence ("Notulen
 * otomatis", docs/DATABASE.md §7 meeting_transcripts). Written by the
 * transcriber worker (RecordTranscriptUpdate) and the summarizer job; read
 * through MeetingTranscriptPolicy (participants, organizer, minute taker).
 * Purged after `purge_after` (PurgeExpiredMeetingTranscripts).
 *
 * @property string $id
 * @property string $meeting_id
 * @property CarbonImmutable $occurrence_date
 * @property string $room
 * @property TranscriptStatus $status
 * @property string|null $error
 * @property string|null $language
 * @property string|null $model
 * @property CarbonImmutable|null $started_at
 * @property CarbonImmutable|null $ended_at
 * @property int|null $duration_seconds
 * @property list<array{speaker_identity: string, user_id: string|null, speaker_name: string, start_ms: int, end_ms: int, text: string}> $segments
 * @property list<string> $sessions
 * @property array<string, mixed>|null $draft
 * @property DraftStatus|null $draft_status
 * @property string|null $draft_error
 * @property string|null $draft_model
 * @property CarbonImmutable|null $draft_generated_at
 * @property CarbonImmutable|null $inserted_at
 * @property string|null $inserted_by
 * @property CarbonImmutable|null $discarded_at
 * @property CarbonImmutable|null $purge_after
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Meeting $meeting
 */
#[Fillable([
    'meeting_id', 'occurrence_date', 'room', 'status', 'error', 'language', 'model', 'started_at', 'ended_at',
    'duration_seconds', 'segments', 'sessions', 'draft', 'draft_status', 'draft_error', 'draft_model',
    'draft_generated_at', 'inserted_at', 'inserted_by', 'discarded_at', 'purge_after',
])]
class MeetingTranscript extends Model
{
    /** @use HasFactory<MeetingTranscriptFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'recording',
        'segments' => '[]',
        'sessions' => '[]',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurrence_date' => 'date',
            'status' => TranscriptStatus::class,
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'duration_seconds' => 'integer',
            'segments' => 'array',
            'sessions' => 'array',
            'draft' => 'array',
            'draft_status' => DraftStatus::class,
            'draft_generated_at' => 'datetime',
            'inserted_at' => 'datetime',
            'discarded_at' => 'datetime',
            'purge_after' => 'datetime',
        ];
    }

    /**
     * @param  Builder<MeetingTranscript>  $query
     */
    public function scopeForOccurrence(Builder $query, string $meetingId, string $date): void
    {
        $query->where('meeting_id', $meetingId)->whereDate('occurrence_date', $date);
    }

    /**
     * @return BelongsTo<Meeting, $this>
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }
}
