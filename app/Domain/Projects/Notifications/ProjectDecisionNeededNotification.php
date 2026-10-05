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
 * An update asks Direksi for a decision (to the sponsor, or every Direksi
 * member when the project has none). Resolved by ResolveProjectDecision.
 */
final class ProjectDecisionNeededNotification extends BaseNotification
{
    public function __construct(public readonly ProjectUpdate $update) {}

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
