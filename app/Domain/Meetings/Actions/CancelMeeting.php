<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Jobs\CloseMeetingRooms;
use App\Domain\Meetings\Notifications\MeetingInvitedNotification;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Meeting;
use App\Models\User;

/**
 * Cancels a meeting or a whole series (it stays readable, marked
 * "Dibatalkan", with its minutes). Internal participants are told. A video
 * meeting's live LiveKit rooms are closed (CloseMeetingRooms, queued after
 * commit; audit R-09). Idempotent.
 */
final class CancelMeeting
{
    public function __construct(private readonly ResolveNotificationsForSubject $resolve) {}

    public function handle(Meeting $meeting, User $actor): Meeting
    {
        if ($meeting->isCanceled()) {
            return $meeting;
        }

        $meeting->forceFill(['canceled_at' => now()])->save();
        $this->resolve->handle($meeting, NotificationType::MeetingStarting);

        if ($meeting->platform === MeetingPlatform::Video) {
            CloseMeetingRooms::dispatch($meeting->id)->afterCommit();
        }

        $meeting->load('participants.user');

        foreach ($meeting->participants as $participant) {
            $user = $participant->user;

            if ($user !== null && $user->id !== $actor->id && $user->isActive()) {
                $user->notify(new MeetingInvitedNotification($meeting, $actor, MeetingInvitedNotification::CANCELED));
            }
        }

        return $meeting;
    }
}
