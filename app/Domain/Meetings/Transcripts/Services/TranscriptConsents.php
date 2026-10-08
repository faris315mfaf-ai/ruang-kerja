<?php

namespace App\Domain\Meetings\Transcripts\Services;

use App\Models\Meeting;
use App\Models\MeetingTranscriptConsent;
use App\Models\User;

/**
 * "Jangan transkrip suara saya" choices per meeting (series). Private: they
 * travel only app → worker (signed exclude list), never as a LiveKit
 * participant attribute that every client in the room would receive.
 */
final class TranscriptConsents
{
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

    public function optedOutCount(Meeting $meeting): int
    {
        return MeetingTranscriptConsent::query()->where('meeting_id', $meeting->id)->where('opted_out', true)->count();
    }
}
