<?php

namespace App\Domain\Meetings\Notifications;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;

/**
 * Invitation and its follow-ups for participants:
 * - `invited`: "Dimas Pratama mengundang Anda: Review vendor logistik"
 *   (ScheduleMeeting, or added later by UpdateMeeting);
 * - `changed`: the time moved, RSVP asked again (UpdateMeeting);
 * - `canceled`: "Rapat dibatalkan: …" (CancelMeeting).
 */
final class MeetingInvitedNotification extends MeetingNotification
{
    public const string INVITED = 'invited';

    public const string CHANGED = 'changed';

    public const string CANCELED = 'canceled';

    public function __construct(
        Meeting $meeting,
        public readonly User $actor,
        public readonly string $mode = self::INVITED,
    ) {
        parent::__construct($meeting);
    }

    public function type(): NotificationType
    {
        return NotificationType::MeetingInvited;
    }

    protected function stillVisibleTo(User $notifiable): bool
    {
        if ($this->mode !== self::CANCELED) {
            return parent::stillVisibleTo($notifiable);
        }

        $meeting = Meeting::query()->find($this->meeting->id);

        return $meeting !== null && app(MeetingPolicy::class)->canView($notifiable, $meeting);
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $title = match ($this->mode) {
            self::CHANGED => "Jadwal rapat berubah: {$this->meeting->title}",
            self::CANCELED => "Rapat dibatalkan: {$this->meeting->title}",
            default => "{$this->actor->name} mengundang Anda: {$this->meeting->title}",
        };

        return new NotificationPayload(
            title: $title,
            body: $this->when().' · '.$this->place(),
            url: $this->url(),
            actor: NotificationActor::fromUser($this->actor),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => 'Lihat rapat',
                'context' => $this->mode === self::CANCELED ? null : $this->meeting->recurrence->label(),
                'context_tone' => $this->mode === self::CANCELED ? 'danger' : null,
            ]),
        );
    }
}
