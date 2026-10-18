<?php

namespace App\Domain\Meetings\Jobs;

use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\MeetingSpeakingTime;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily: deletes "Waktu bicara" rows of occurrences older than the
 * transcript retention (MINUTES_TRANSCRIPT_RETENTION_DAYS, default 90;
 * config livekit.speaking_retention_days), so speaking time and transcripts
 * expire together (lead decision 7 Okt 2026). meeting_attendances are kept
 * (open decision of the owner). Returns the number of rows deleted.
 */
final class PruneSpeakingTimes implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $uniqueFor = 600;

    public function handle(): int
    {
        $days = max(1, (int) config('livekit.speaking_retention_days', 90));
        $cutoff = CarbonImmutable::now()->setTimezone(CurrentCompany::timezone())->subDays($days)->toDateString();

        return MeetingSpeakingTime::query()->where('occurrence_date', '<', $cutoff)->delete();
    }
}
