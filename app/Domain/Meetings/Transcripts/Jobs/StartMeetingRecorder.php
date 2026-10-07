<?php

namespace App\Domain\Meetings\Transcripts\Jobs;

use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Meetings\Transcripts\Services\RecorderToken;
use App\Domain\Meetings\Transcripts\Services\TranscriberClient;
use App\Domain\Meetings\Transcripts\Services\TranscriptConsents;
use App\Models\Meeting;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Asks the worker to join a room as the hidden recorder, with a fresh
 * subscribe-only token and the people who opted out (never recorded).
 */
class StartMeetingRecorder implements ShouldQueue
{
    use Queueable;

    public int $tries = 4;

    /** @var list<int> */
    public array $backoff = [5, 15, 45];

    public function __construct(public string $meetingId, public string $room) {}

    public function handle(NotulenConfig $config, RecorderToken $tokens, TranscriberClient $client, TranscriptConsents $consents): void
    {
        $meeting = Meeting::query()->find($this->meetingId);

        if ($meeting === null || ! NotulenConfig::autoMinutes($meeting) || ! $config->availableFor($meeting)) {
            return;
        }

        $client->join($this->room, $tokens->for($this->room), $consents->optedOutIds($meeting));
    }
}
