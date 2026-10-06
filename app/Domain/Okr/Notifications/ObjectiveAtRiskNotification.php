<?php

namespace App\Domain\Okr\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Okr\Enums\OkrStatus;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * The status of an objective dropped (NotifyObjectiveAtRisk) → its owner and
 * the Kepala Divisi.
 */
final class ObjectiveAtRiskNotification extends BaseNotification
{
    public function __construct(
        public readonly Objective $objective,
        public readonly OkrStatus $status,
    ) {}

    protected function stillVisibleTo(User $notifiable): bool
    {
        $objective = Objective::query()->find($this->objective->id);

        return $objective !== null && Gate::forUser($notifiable)->allows('view', $objective);
    }

    public function type(): NotificationType
    {
        return NotificationType::OkrObjectiveAtRisk;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $label = mb_strtolower($this->status->label());

        return new NotificationPayload(
            title: "Objective {$label}: {$this->objective->title}",
            body: $this->status === OkrStatus::Behind
                ? 'Progres tertinggal lebih dari 25 poin dari bagian kuartal yang sudah lewat. Tinjau key result dan hambatannya.'
                : 'Progres tertinggal 10–25 poin dari bagian kuartal yang sudah lewat. Tinjau key result yang perlu perhatian.',
            url: "/okr/{$this->objective->id}",
            subject: NotificationSubject::fromModel($this->objective, null, $this->objective->title),
            meta: [
                'open_label' => 'Buka objective',
                'context' => $this->status->label(),
                'context_tone' => $this->status === OkrStatus::Behind ? 'danger' : 'warning',
            ],
        );
    }
}
