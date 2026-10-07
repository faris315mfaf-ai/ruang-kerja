<?php

namespace App\Domain\Meetings\Notifications;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Meeting;
use App\Models\User;

/**
 * "Koordinasi peluncuran Q4 mulai 5 menit lagi" (SendMeetingReminders, per
 * `meetings.reminders` minute and occurrence, de-duplicated in
 * notification_dispatch_logs). Not sent to participants who declined.
 * Video RuangKerja meetings link straight to the pre-join screen ("Gabung").
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

        // Video RuangKerja: the primary action opens the in-app pre-join
        // screen, the secondary one the meeting detail.
        $video = $this->meeting->platform === MeetingPlatform::Video;

        return new NotificationPayload(
            title: $title,
            body: $this->when().' · '.$this->place(),
            url: $video ? $this->url('/gabung') : $this->url(),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => $video ? 'Gabung' : 'Buka rapat',
                'context_tone' => 'warning',
                'plan_url' => $video ? $this->url() : null,
                'plan_label' => $video ? 'Lihat detail' : null,
            ]),
        );
    }
}
