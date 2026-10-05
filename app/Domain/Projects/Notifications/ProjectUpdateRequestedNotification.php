<?php

namespace App\Domain\Projects\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Gate;

/**
 * "Minta update" from Direksi to the PIC. Stays in "Perlu tindakan" until the
 * next project update is posted (PostProjectUpdate resolves it).
 */
final class ProjectUpdateRequestedNotification extends BaseNotification
{
    public function __construct(
        public readonly Workspace $workspace,
        public readonly User $requester,
        public readonly ?string $note = null,
    ) {}

    /**
     * Dropped when the project was deleted or the recipient lost access to it
     * while the notification waited in the queue (fresh row, soft-delete scope).
     */
    protected function stillVisibleTo(User $notifiable): bool
    {
        $workspace = Workspace::query()->find($this->workspace->id);

        return $workspace !== null && Gate::forUser($notifiable)->allows('view', $workspace);
    }

    public function type(): NotificationType
    {
        return NotificationType::ProjectUpdateRequested;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->requester->name} meminta update {$this->workspace->name}",
            body: $this->note ?? 'Mohon tulis update proyek terbaru: status, ringkasan, hambatan, dan keputusan yang dibutuhkan.',
            url: "/w/{$this->workspace->key}/ringkasan?update=1",
            actor: NotificationActor::fromUser($this->requester),
            subject: NotificationSubject::fromModel($this->workspace, $this->workspace->key, $this->workspace->name),
            meta: ['open_label' => 'Tulis update', 'quote' => $this->note !== null],
        );
    }
}
