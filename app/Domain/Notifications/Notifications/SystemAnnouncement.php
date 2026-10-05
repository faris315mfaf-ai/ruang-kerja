<?php

namespace App\Domain\Notifications\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * Built-in example: a system notice ("Pengumuman") with optional link.
 * Also the reference implementation for modules (HOW-TO-NOTIFY.md).
 */
final class SystemAnnouncement extends BaseNotification
{
    public function __construct(
        public readonly string $title,
        public readonly ?string $body = null,
        public readonly ?string $url = null,
        public readonly ?User $actor = null,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::SystemAnnouncement;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: $this->title,
            body: $this->body,
            url: $this->url,
            actor: $this->actor ? NotificationActor::fromUser($this->actor) : null,
            meta: ['open_label' => 'Buka'],
        );
    }
}
