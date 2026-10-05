<?php

namespace App\Domain\Projects\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\ProjectDirection;
use App\Models\User;

/**
 * "Beri arahan": a direction from Direksi to the PIC (and the update author).
 */
final class ProjectDirectionNotification extends BaseNotification
{
    public function __construct(public readonly ProjectDirection $direction) {}

    public function type(): NotificationType
    {
        return NotificationType::ProjectDirection;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $workspace = $this->direction->workspace;
        $author = $this->direction->author;

        return new NotificationPayload(
            title: ($author->name ?? 'Direksi')." memberi arahan untuk {$workspace->name}",
            body: $this->direction->body,
            url: "/w/{$workspace->key}/ringkasan#arahan",
            actor: $author !== null ? NotificationActor::fromUser($author) : null,
            subject: NotificationSubject::fromModel($workspace, $workspace->key, $workspace->name),
            meta: ['open_label' => 'Buka proyek', 'quote' => true],
        );
    }
}
