<?php

namespace App\Domain\Projects\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Gate;

/**
 * Direksi marked the decision of an update as done ("Setujui").
 */
final class ProjectDecisionResolvedNotification extends BaseNotification
{
    public function __construct(
        public readonly ProjectUpdate $update,
        public readonly User $resolver,
    ) {}

    /**
     * Dropped when the project was deleted or the recipient lost access to it
     * while the notification waited in the queue (fresh row, soft-delete scope).
     */
    protected function stillVisibleTo(User $notifiable): bool
    {
        $workspace = Workspace::query()->find($this->update->workspace_id);

        return $workspace !== null && Gate::forUser($notifiable)->allows('view', $workspace);
    }

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
