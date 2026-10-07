<?php

namespace App\Domain\Meetings\Jobs;

use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Notifications\MeetingStartingNotification;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Models\Meeting;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Every minute: "Rapat segera dimulai" for each reminder minute of
 * `meetings.reminders` that has been reached for an upcoming occurrence
 * (one reminder per participant, occurrence and minute — claimed in
 * notification_dispatch_logs, so late or repeated runs never send twice).
 * Participants who declined and inactive accounts are skipped.
 */
final class SendMeetingReminders implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** Largest reminder offset allowed by meetings_reminders_check. */
    public const int HORIZON_MINUTES = 60;

    public int $uniqueFor = 55;

    public function handle(MeetingOccurrences $occurrences, NotificationDispatchLog $dispatchLog): int
    {
        $now = CarbonImmutable::now();
        $horizon = $now->addMinutes(self::HORIZON_MINUTES + 1);
        $sent = 0;

        $meetings = Meeting::query()
            ->active()
            ->overlapping($now, $horizon)
            ->with('participants.user')
            ->get();

        foreach ($occurrences->between($meetings, $now, $horizon) as $occurrence) {
            if ($occurrence->startsAt->lte($now)) {
                continue;
            }

            $minutesLeft = (int) ceil($now->diffInSeconds($occurrence->startsAt) / 60);
            // Reached reminder offsets, largest first: a meeting created late gets one reminder now, not several.
            $due = array_values(array_filter($occurrence->meeting->reminders, fn (int $offset): bool => $offset > 0 && $minutesLeft <= $offset));
            rsort($due);

            if ($due === []) {
                continue;
            }

            foreach ($occurrence->meeting->participants as $participant) {
                $user = $participant->user;

                if ($user === null || $participant->rsvp === Rsvp::No || ! $user->isActive()) {
                    continue;
                }

                $claimed = false;

                foreach ($due as $offset) {
                    $claimed = $dispatchLog->claim($user, NotificationType::MeetingStarting, $occurrence->meeting, $occurrence->date.':'.$offset) || $claimed;
                }

                if ($claimed) {
                    $user->notify(new MeetingStartingNotification($occurrence->meeting, $occurrence->date, $minutesLeft));
                    $sent++;
                }
            }
        }

        return $sent;
    }
}
