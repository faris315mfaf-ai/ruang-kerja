<?php

namespace App\Domain\Meetings\Notifications;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Meeting;
use App\Models\User;

/**
 * "Rapat sudah dimulai — Gabung": the organizer or minute taker calls an
 * invited employee who is not in the video room yet (CallMeetingParticipant).
 * Uses the `meeting.starting` type (same preference event `meeting`, same
 * "Gabung" layout in the Inbox and toast); the link opens the pre-join screen.
 */
final class MeetingCalledNotification extends MeetingNotification
{
    public function __construct(Meeting $meeting, string $date, public readonly User $caller)
    {
        parent::__construct($meeting, $date);
    }

    public function type(): NotificationType
    {
        return NotificationType::MeetingStarting;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: 'Rapat sudah dimulai — Gabung',
            body: "{$this->caller->name} memanggil Anda ke {$this->meeting->title} · {$this->when()}",
            url: $this->url('/gabung'),
            actor: NotificationActor::fromUser($this->caller),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => 'Gabung',
                'context_tone' => 'warning',
                'plan_url' => $this->url(),
                'plan_label' => 'Lihat detail',
            ]),
        );
    }
}
