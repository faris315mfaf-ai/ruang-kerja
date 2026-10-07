<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use App\Domain\Meetings\Transcripts\Exceptions\TranscriptConflict;
use App\Domain\Meetings\Transcripts\Jobs\SummarizeMeetingTranscript;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Models\MeetingTranscript;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * "Ringkas ulang": queue a new AI draft (after a failure, after "Buang
 * draf", or when the key was added later, or when a "pending" draft is
 * older than the job may run). Not after the draft was inserted.
 */
final class ResummarizeTranscript
{
    /** SummarizeMeetingTranscript::$timeout (900 s) + margin. */
    public const int STALE_PENDING_SECONDS = 1200;

    public function __construct(private readonly NotulenConfig $config) {}

    public function handle(MeetingTranscript $transcript): MeetingTranscript
    {
        if (! $this->config->llmEnabled()) {
            throw new TranscriptConflict('Ringkasan AI belum diaktifkan admin (MINUTES_LLM_API_KEY).');
        }

        $locked = DB::transaction(function () use ($transcript): MeetingTranscript {
            $locked = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->firstOrFail();

            // A "pending" draft older than the job may run is stale (worker killed,
            // deploy): it may be re-run (audit rapat 2026-10 T-02).
            $stale = $locked->draft_status === DraftStatus::Pending
                && $locked->updated_at !== null
                && $locked->updated_at->lt(CarbonImmutable::now()->subSeconds(self::STALE_PENDING_SECONDS));
            $ready = $locked->status === TranscriptStatus::Ready || ($stale && $locked->status === TranscriptStatus::Summarizing);

            if (! $ready || $locked->segments === []) {
                throw new TranscriptConflict('Transkrip belum siap.');
            }

            if ($locked->draft_status === DraftStatus::Inserted || ($locked->draft_status === DraftStatus::Pending && ! $stale)) {
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
