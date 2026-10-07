<?php

namespace App\Domain\Meetings\Transcripts\Services;

use App\Models\Meeting;
use App\Models\MeetingTranscriptConsent;
use App\Models\User;

/**
 * "Jangan transkrip suara saya" choices per meeting (series).
 */
final class TranscriptConsents
{
    public const string ATTRIBUTE = 'rk_notulen_optout';

    public function optedOut(Meeting $meeting, User $user): bool
    {
        return MeetingTranscriptConsent::query()
            ->where('meeting_id', $meeting->id)
            ->where('user_id', $user->id)
            ->where('opted_out', true)
            ->exists();
    }

    /**
     * @return list<string> user ids who opted out of this meeting's transcripts
     */
    public function optedOutIds(Meeting $meeting): array
    {
        return array_values(array_map(
            fn (mixed $id): string => (string) $id,
            MeetingTranscriptConsent::query()->where('meeting_id', $meeting->id)->where('opted_out', true)->pluck('user_id')->all(),
        ));
    }

    /**
     * LiveKit participant attribute for the person's choice.
     *
     * @return array<string, string>
     */
    public static function attributes(bool $optedOut): array
    {
        return [self::ATTRIBUTE => $optedOut ? '1' : '0'];
    }
}
