<?php

namespace App\Domain\Meetings\Transcripts\Jobs;

use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use App\Domain\Meetings\Transcripts\Services\MinutesSummarizer;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Models\MeetingTranscript;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * AI draft minutes for a ready transcript (MinutesSummarizer). The HTTP
 * client retries itself; a failure leaves the transcript readable with
 * draft_status `failed` ("Ringkas ulang" tries again). A draft that was
 * inserted or discarded meanwhile is never overwritten.
 */
class SummarizeMeetingTranscript implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 900;

    public function __construct(public string $meetingId, public string $date) {}

    public function handle(MinutesSummarizer $summarizer, NotulenConfig $config): void
    {
        $transcript = MeetingTranscript::query()->forOccurrence($this->meetingId, $this->date)->with('meeting')->first();

        if ($transcript === null || $transcript->draft_status !== DraftStatus::Pending) {
            return;
        }

        if (! $config->llmEnabled() || $transcript->segments === []) {
            $this->finish($transcript, ['draft_status' => DraftStatus::Disabled]);

            return;
        }

        try {
            $result = $summarizer->summarize($transcript, $transcript->meeting);
            $this->finish($transcript, [
                'draft' => $result['draft'],
                'draft_status' => DraftStatus::Ready,
                'draft_model' => mb_substr($result['model'], 0, 80),
                'draft_generated_at' => CarbonImmutable::now(),
                'draft_error' => null,
            ]);
        } catch (Throwable $exception) {
            // Never log transcript text or the API key.
            Log::warning('Meeting transcript summary failed', ['transcript' => $transcript->id, 'error' => $exception->getMessage()]);
            $this->finish($transcript, [
                'draft_status' => DraftStatus::Failed,
                'draft_error' => mb_substr($exception instanceof \RuntimeException ? $exception->getMessage() : 'Ringkasan AI gagal dibuat.', 0, 300),
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function finish(MeetingTranscript $transcript, array $values): void
    {
        DB::transaction(function () use ($transcript, $values): void {
            $fresh = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->first();

            // Inserted/discarded meanwhile, or the input changed (a newer job runs): drop this result.
            if ($fresh === null || $fresh->draft_status !== DraftStatus::Pending || $fresh->segments != $transcript->segments) {
                return;
            }

            $fresh->forceFill([
                ...$values,
                'status' => $fresh->status === TranscriptStatus::Summarizing ? TranscriptStatus::Ready : $fresh->status,
            ])->save();
        });
    }
}
