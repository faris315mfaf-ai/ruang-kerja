<?php

namespace App\Domain\Chat\Notifications;

use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * "Sari Wulandari menyebut Anda di #plq" — also in muted channels. Only sent
 * to people who can read the channel, once per message and person.
 */
final class ChatMentionNotification extends ChatNotification
{
    public function type(): NotificationType
    {
        return NotificationType::Mention;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->actor->name} menyebut Anda di {$this->title($notifiable)}",
            body: $this->excerpt(),
            url: $this->url(),
            actor: $this->actorData(),
            subject: $this->subject($notifiable),
            meta: $this->meta(),
        );
    }
}
