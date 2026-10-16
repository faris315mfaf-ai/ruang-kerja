<?php

namespace App\Domain\Chat\Notifications;

use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;

/**
 * "Pesan baru dari Sari Wulandari" (DM) / "Sari Wulandari di Sari, Maya, Rizky"
 * (group). At most one unread Inbox row per channel and recipient (PostMessage).
 *
 * Follow-up messages while that row is still unread are push-only
 * ($pendingInboxId): they ring the phone again but replace the previous push
 * in the shade (tag = conversation) and tapping marks the existing row read.
 */
final class DirectMessageNotification extends ChatNotification
{
    public function __construct(
        Channel $channel,
        Message $message,
        User $actor,
        public readonly ?string $pendingInboxId = null,
    ) {
        parent::__construct($channel, $message, $actor);
    }

    public function pushOnly(): bool
    {
        return $this->pendingInboxId !== null;
    }

    public function pushTag(): string
    {
        return 'chat:'.$this->channel->id;
    }

    public function pushGroupKey(): string
    {
        return 'chat:'.$this->channel->id;
    }

    public function pushInboxId(): ?string
    {
        return $this->pendingInboxId;
    }

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
