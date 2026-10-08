<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Exceptions\TranscriptConflict;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingTranscript;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * "Buang draf": the AI draft is dropped (content cleared); the transcript
 * stays until its retention ends. "Ringkas ulang" can make a new draft.
 */
final class DiscardTranscriptDraft
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, MeetingTranscript $transcript): MeetingTranscript
    {
        return DB::transaction(function () use ($actor, $transcript): MeetingTranscript {
            $locked = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->firstOrFail();

            if (! in_array($locked->draft_status, [DraftStatus::Ready, DraftStatus::Failed], true)) {
                throw new TranscriptConflict($locked->draft_status === DraftStatus::Inserted
                    ? 'Draf ini sudah dimasukkan ke notulen.'
                    : 'Tidak ada draf yang bisa dibuang.');
            }

            $locked->forceFill([
                'draft' => null,
                'draft_status' => DraftStatus::Discarded,
                'draft_error' => null,
                'discarded_at' => CarbonImmutable::now(),
            ])->save();
            $this->audit->log('meeting.transcript_draft_discarded', $locked, null, null, $actor);

            return $locked;
        });
    }
}
