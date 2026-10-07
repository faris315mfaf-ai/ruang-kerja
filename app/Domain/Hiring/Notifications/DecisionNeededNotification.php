<?php

namespace App\Domain\Hiring\Notifications;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Candidate;
use App\Models\User;

/**
 * To each final approver ("Perlu tindakan"): a candidate entered
 * "Keputusan akhir". Resolved when the candidate is decided or moved back.
 */
final class DecisionNeededNotification extends HiringNotification
{
    public function __construct(Candidate $candidate, public readonly ?User $actor = null)
    {
        parent::__construct($candidate);
    }

    public function type(): NotificationType
    {
        return NotificationType::HiringDecisionNeeded;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->candidate->full_name} menunggu keputusan akhir Anda",
            body: $this->positionTitle(),
            url: $this->url().'?tab=keputusan',
            actor: $this->actor !== null ? NotificationActor::fromUser($this->actor) : null,
            subject: $this->subject(),
            meta: ['open_label' => 'Beri keputusan'],
        );
    }

    protected function externalTitle(): string
    {
        return "Kandidat {$this->positionTitle()} menunggu keputusan akhir Anda";
    }
}
