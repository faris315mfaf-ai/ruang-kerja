<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use App\Domain\Meetings\Transcripts\Exceptions\TranscriptConflict;
use App\Domain\Meetings\Transcripts\Jobs\SummarizeMeetingTranscript;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Models\MeetingTranscript;
use Illuminate\Support\Facades\DB;

/**
 * "Ringkas ulang": queue a new AI draft (after a failure, after "Buang
 * draf", or when the key was added later). Not after the draft was inserted.
 */
final class ResummarizeTranscript
{
    public function __construct(private readonly NotulenConfig $config) {}

    public function handle(MeetingTranscript $transcript): MeetingTranscript
    {
        if (! $this->config->llmEnabled()) {
            throw new TranscriptConflict('Ringkasan AI belum diaktifkan admin (MINUTES_LLM_API_KEY).');
        }

        $locked = DB::transaction(function () use ($transcript): MeetingTranscript {
            $locked = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== TranscriptStatus::Ready || $locked->segments === []) {
                throw new TranscriptConflict('Transkrip belum siap.');
            }

            if (in_array($locked->draft_status, [DraftStatus::Inserted, DraftStatus::Pending], true)) {
                throw new TranscriptConflict($locked->draft_status === DraftStatus::Inserted
                    ? 'Draf ini sudah dimasukkan ke notulen.'
                    : 'Draf sedang disusun.');
            }

            $locked->forceFill([
                'draft' => null,
                'draft_status' => DraftStatus::Pending,
                'draft_error' => null,
                'discarded_at' => null,
                'status' => TranscriptStatus::Summarizing,
            ])->save();

            return $locked;
        });

        SummarizeMeetingTranscript::dispatch($locked->meeting_id, $locked->occurrence_date->toDateString());

        return $locked;
    }
}
