<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use App\Domain\Meetings\Transcripts\Jobs\RelayTranscriptConsent;
use App\Domain\Meetings\Transcripts\Jobs\SummarizeMeetingTranscript;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Meeting;
use App\Models\MeetingTranscript;
use App\Models\MeetingTranscriptConsent;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Jangan transkrip suara saya" (UU PDP): the person's choice for this
 * meeting (series) is stored and audited. Opting out
 * - tells the worker right away when it is recording a room of this meeting
 *   (it unsubscribes and deletes that person's audio),
 * - removes the person's lines from transcripts of this meeting that were
 *   not moved into the minutes yet, and re-runs an open AI draft — or drops
 *   it when it cannot be re-run (they were the only speaker, no AI key).
 */
final class SetTranscriptConsent
{
    public function __construct(
        private readonly NotulenConfig $config,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Meeting $meeting, User $user, bool $optedOut): bool
    {
        $resummarize = [];

        DB::transaction(function () use ($meeting, $user, $optedOut, &$resummarize): void {
            $consent = MeetingTranscriptConsent::query()->firstOrNew(['meeting_id' => $meeting->id, 'user_id' => $user->id]);
            $changed = ! $consent->exists || $consent->opted_out !== $optedOut;
            $consent->opted_out = $optedOut;
            $consent->save();

            if ($changed) {
                $this->audit->log('meeting.transcript_consent_changed', $meeting, null, ['opted_out' => $optedOut], $user);
            }

            if (! $optedOut) {
                return;
            }

            $transcripts = MeetingTranscript::query()->where('meeting_id', $meeting->id)->whereNull('inserted_at')->lockForUpdate()->get();

            foreach ($transcripts as $transcript) {
                $kept = array_values(array_filter($transcript->segments, fn (array $s): bool => $s['speaker_identity'] !== $user->id));

                if (count($kept) === count($transcript->segments)) {
                    continue;
                }

                $rerun = $this->config->llmEnabled() && $kept !== []
                    && in_array($transcript->draft_status, [DraftStatus::Ready, DraftStatus::Pending, DraftStatus::Failed], true);
                // A draft built from the person's words never outlives the opt-out: re-run
                // it when possible, otherwise drop it (only speaker, AI key removed, …;
                // audit rapat 2026-10 T-01).
                $drop = ! $rerun && in_array($transcript->draft_status, [DraftStatus::Ready, DraftStatus::Pending, DraftStatus::Failed], true);

                $transcript->forceFill([
                    'segments' => $kept,
                    'draft' => $rerun || $drop ? null : $transcript->draft,
                    'draft_status' => $rerun ? DraftStatus::Pending : ($drop ? DraftStatus::Discarded : $transcript->draft_status),
                    'discarded_at' => $drop ? now() : $transcript->discarded_at,
                    'status' => $rerun && $transcript->status === TranscriptStatus::Ready ? TranscriptStatus::Summarizing
                        : ($drop && $transcript->status === TranscriptStatus::Summarizing ? TranscriptStatus::Ready : $transcript->status),
                ])->save();

                if ($rerun) {
                    $resummarize[] = $transcript->occurrence_date->toDateString();
                }
            }
        });

        foreach ($resummarize as $date) {
            SummarizeMeetingTranscript::dispatch($meeting->id, $date);
        }

        if ($this->config->availableFor($meeting)) {
            $recording = MeetingTranscript::query()->where('meeting_id', $meeting->id)
                ->where('status', TranscriptStatus::Recording->value)->pluck('room');

            foreach ($recording as $room) {
                RelayTranscriptConsent::dispatch((string) $room, $user->id, $optedOut);
            }
        }

        return $optedOut;
    }
}
