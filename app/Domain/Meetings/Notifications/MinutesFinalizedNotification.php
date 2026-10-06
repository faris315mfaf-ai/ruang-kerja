<?php

namespace App\Domain\Meetings\Notifications;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Meeting;
use App\Models\User;

/**
 * "Notulen final: Stand-up Divisi Operasional" to the internal participants
 * (FinalizeMinutes). Only counts leave the app: decisions are read in-app.
 */
final class MinutesFinalizedNotification extends MeetingNotification
{
    public function __construct(
        Meeting $meeting,
        string $date,
        public readonly User $actor,
        public readonly int $decisions,
        public readonly int $actionItems,
    ) {
        parent::__construct($meeting, $date);
    }

    public function type(): NotificationType
    {
        return NotificationType::MinutesFinalized;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "Notulen final: {$this->meeting->title}",
            body: $this->when().' · '.$this->decisions.' keputusan · '.$this->actionItems.' tindak lanjut',
            url: $this->url('/notulen'),
            actor: NotificationActor::fromUser($this->actor),
            subject: $this->subject(),
            meta: self::meta(['open_label' => 'Baca notulen']),
        );
    }
}
