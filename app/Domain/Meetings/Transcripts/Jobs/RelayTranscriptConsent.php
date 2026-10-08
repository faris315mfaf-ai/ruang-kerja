<?php

namespace App\Domain\Meetings\Transcripts\Jobs;

use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Meetings\Transcripts\Services\TranscriberClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * A consent change while the worker records the room: stop (or resume)
 * recording that person; opting out also deletes their spooled audio.
 */
class RelayTranscriptConsent implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [2, 10];

    public function __construct(public string $room, public string $userId, public bool $optedOut) {}

    public function handle(NotulenConfig $config, TranscriberClient $client): void
    {
        if ($config->configured()) {
            $client->exclude($this->room, $this->userId, $this->optedOut);
        }
    }
}
