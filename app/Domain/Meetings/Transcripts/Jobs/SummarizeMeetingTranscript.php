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
use Illuminate\Queue\MaxAttemptsExceededException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * AI draft minutes for a ready transcript (MinutesSummarizer). The HTTP
 * client retries itself; a failure leaves the transcript readable with
 * draft_status `failed` ("Ringkas ulang" tries again). A draft that was
 * inserted or discarded meanwhile is never overwritten. Runs on the `long`
 * queue (connection redis-long, retry_after 960 s > timeout 900 s).
 */
class SummarizeMeetingTranscript implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 900;

    public function __construct(public string $meetingId, public string $date)
    {
        // Audit T-05: up to 900 s, so never on the default connection (retry_after 90 s).
        // `long` = Horizon supervisor-long; redis-long retry_after 960 s (config/queue.php).
        if (config('queue.default') === 'redis') {
            $this->onConnection('redis-long');
        }

        $this->onQueue('long');
    }

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
     * The job died outside handle()'s try (timeout, worker killed): the draft
     * must not stay "pending" forever, which would also block "Ringkas ulang"
     * (audit rapat 2026-10 T-02). Never stores the exception text.
     */
    public function failed(?Throwable $exception): void
    {
        // Re-reserved after the queue's retry_after while the first run may still be
        // working: leave it to that run (a stale "pending" can be re-run, ResummarizeTranscript).
        if ($exception instanceof MaxAttemptsExceededException) {
            return;
        }

        $transcript = MeetingTranscript::query()->forOccurrence($this->meetingId, $this->date)->first();

        if ($transcript === null) {
            return;
        }

        DB::transaction(function () use ($transcript): void {
            $fresh = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->first();

            if ($fresh === null || $fresh->draft_status !== DraftStatus::Pending) {
                return;
            }

            $fresh->forceFill([
                'draft_status' => DraftStatus::Failed,
                'draft_error' => 'Ringkasan AI terlalu lama atau terhenti. Coba "Ringkas ulang".',
                'status' => $fresh->status === TranscriptStatus::Summarizing ? TranscriptStatus::Ready : $fresh->status,
            ])->save();
        });
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
