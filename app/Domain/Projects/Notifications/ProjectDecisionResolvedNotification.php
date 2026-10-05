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
 * Direksi marked the decision of an update as done ("Setujui").
 */
final class ProjectDecisionResolvedNotification extends BaseNotification
{
    public function __construct(
        public readonly ProjectUpdate $update,
        public readonly User $resolver,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::ProjectDecisionResolved;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $workspace = $this->update->workspace;

        return new NotificationPayload(
            title: "{$this->resolver->name} menandai keputusan selesai di {$workspace->name}",
            body: (string) $this->update->decision_needed,
            url: "/w/{$workspace->key}/ringkasan",
            actor: NotificationActor::fromUser($this->resolver),
            subject: NotificationSubject::fromModel($this->update, $workspace->key, $workspace->name),
            meta: ['open_label' => 'Buka proyek', 'quote' => true, 'context' => 'Keputusan selesai', 'context_tone' => 'success'],
        );
    }
}
