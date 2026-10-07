<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Transcripts\Queries\NotulenSummary;
use App\Models\User;

/**
 * The `notulen` prop (automatic minutes summary, agent notulen,
 * docs/fitur/notulen-otomatis-kontrak.md §2.1/§3) of the meeting detail,
 * pre-join and room pages: NotulenSummary for video meetings, null for
 * other platforms (no LiveKit room, nothing to transcribe).
 */
final class NotulenBridge
{
    public function __construct(private readonly NotulenSummary $summary) {}

    /**
     * @return array<string, mixed>|null
     */
    public function summary(Occurrence $occurrence, User $viewer): ?array
    {
        if ($occurrence->meeting->platform !== MeetingPlatform::Video) {
            return null;
        }

        return $this->summary->for($occurrence, $viewer);
    }

    /**
     * "Notulen otomatis aktif" for the room (available and switched on).
     *
     * @param  array<string, mixed>|null  $summary
     */
    public static function autoMinutes(?array $summary): bool
    {
        return $summary !== null && ($summary['available'] ?? false) === true && ($summary['auto_minutes'] ?? false) === true;
    }
}
