<?php

namespace App\Domain\Chat\Notifications;

use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * "Pesan baru dari Sari Wulandari" (DM) / "Sari Wulandari di Sari, Maya, Rizky"
 * (group). At most one unread per channel and recipient (PostMessage).
 */
final class DirectMessageNotification extends ChatNotification
{
    public function type(): NotificationType
    {
        return NotificationType::ChatMessage;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $title = $this->channel->type === ChannelType::Dm
            ? "Pesan baru dari {$this->actor->name}"
            : "{$this->actor->name} di {$this->title($notifiable)}";

        return new NotificationPayload(
            title: $title,
            body: $this->excerpt(),
            url: $this->url(),
            actor: $this->actorData(),
            subject: $this->subject($notifiable),
            meta: $this->meta(),
        );
    }
}
