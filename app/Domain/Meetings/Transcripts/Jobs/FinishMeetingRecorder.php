<?php

namespace App\Domain\Meetings\Transcripts\Jobs;

use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Meetings\Transcripts\Services\TranscriberClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * The room ended: the worker stops recording and queues the transcription
 * ("unknown" = it was not recording, or already left on its own).
 */
class FinishMeetingRecorder implements ShouldQueue
{
    use Queueable;

    public int $tries = 4;

    /** @var list<int> */
    public array $backoff = [5, 15, 45];

    public function __construct(public string $room) {}

    public function handle(NotulenConfig $config, TranscriberClient $client): void
    {
        if ($config->configured()) {
            $client->finish($this->room);
        }
    }
}
