<?php

namespace App\Domain\Meetings\Notifications;

use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Meeting;
use App\Models\User;

/**
 * "Koordinasi peluncuran Q4 mulai 5 menit lagi" (SendMeetingReminders, per
 * `meetings.reminders` minute and occurrence, de-duplicated in
 * notification_dispatch_logs). Not sent to participants who declined.
 */
final class MeetingStartingNotification extends MeetingNotification
{
    public function __construct(Meeting $meeting, string $date, public readonly int $minutes)
    {
        parent::__construct($meeting, $date);
    }

    public function type(): NotificationType
    {
        return NotificationType::MeetingStarting;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $title = $this->minutes <= 0
            ? "{$this->meeting->title} dimulai sekarang"
            : "{$this->meeting->title} mulai {$this->minutes} menit lagi";

        return new NotificationPayload(
            title: $title,
            body: $this->when().' · '.$this->place(),
            url: $this->url(),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => 'Buka rapat',
                'context_tone' => 'warning',
            ]),
        );
    }
}
