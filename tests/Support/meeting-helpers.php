<?php

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/*
 * Shared helpers for the meeting tests (require_once in each file).
 */

if (! function_exists('meetingVerdict')) {
    /** 'allow' · 'deny' (403) · 'hidden' (404). */
    function meetingVerdict(User $user, string $ability, mixed $arguments): string
    {
        $response = Gate::forUser($user)->inspect($ability, $arguments);

        return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
    }

    function occurrenceOf(Meeting $meeting, ?string $date = null): Occurrence
    {
        return app(MeetingOccurrences::class)->resolve($meeting->fresh() ?? $meeting, $date);
    }

    /**
     * @return array<string, mixed>
     */
    function meetingPayload(array $overrides = []): array
    {
        return [
            'title' => 'Review vendor logistik',
            'date' => '2026-10-06',
            'start' => '13:30',
            'duration' => 60,
            'platform' => 'meet',
            'join_url' => 'https://meet.google.com/abc-defg-hij',
            'location' => null,
            'participant_ids' => [],
            'guest_emails' => [],
            'agenda' => ['Evaluasi pengiriman', 'Penawaran harga'],
            'recurrence' => 'none',
            'recurrence_until' => null,
            'reminders' => [15, 5],
            'minute_taker_id' => null,
            'workspace_id' => null,
            ...$overrides,
        ];
    }
}
