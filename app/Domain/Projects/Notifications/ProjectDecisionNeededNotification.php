<?php

namespace App\Domain\Projects\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\ProjectUpdate;
use App\Models\User;

/**
 * An update asks Direksi for a decision (to the sponsor, or every Direksi
 * member when the project has none). Resolved by ResolveProjectDecision.
 */
final class ProjectDecisionNeededNotification extends BaseNotification
{
    public function __construct(public readonly ProjectUpdate $update) {}

    public function type(): NotificationType
    {
        return NotificationType::ProjectDecisionNeeded;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $workspace = $this->update->workspace;
        $author = $this->update->author;

        return new NotificationPayload(
            title: ($author->name ?? 'PIC')." butuh keputusan Anda untuk {$workspace->name}",
            body: (string) $this->update->decision_needed,
            url: '/portofolio#keputusan',
            actor: $author !== null ? NotificationActor::fromUser($author) : null,
            subject: NotificationSubject::fromModel($this->update, $workspace->key, $workspace->name),
            meta: ['open_label' => 'Buka portofolio', 'quote' => true],
        );
    }
}
