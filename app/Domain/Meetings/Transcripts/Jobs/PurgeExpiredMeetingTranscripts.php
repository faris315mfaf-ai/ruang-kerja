<?php

namespace App\Domain\Meetings\Transcripts\Jobs;

use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\MeetingTranscript;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Retention (UU PDP): transcripts and their AI drafts are deleted after
 * `purge_after` (MINUTES_TRANSCRIPT_RETENTION_DAYS, default 90 days after
 * the meeting). Text moved into the minutes stays with the minutes.
 */
class PurgeExpiredMeetingTranscripts implements ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public function handle(): int
    {
        $deleted = MeetingTranscript::query()
            ->whereNotNull('purge_after')
            ->where('purge_after', '<=', CarbonImmutable::now())
            ->delete();

        if ($deleted > 0) {
            Log::info('Purged expired meeting transcripts', ['count' => $deleted]);
        }

        return (int) $deleted;
    }
}
