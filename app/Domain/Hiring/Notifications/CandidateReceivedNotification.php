<?php

namespace App\Domain\Hiring\Notifications;

use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * To HR: a new applicant arrived from the position's Google Form.
 */
final class CandidateReceivedNotification extends HiringNotification
{
    public function type(): NotificationType
    {
        return NotificationType::HiringCandidateReceived;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->candidate->full_name} melamar {$this->positionTitle()}",
            body: 'Masuk lewat Google Form',
            url: $this->url(),
            subject: $this->subject(),
            meta: ['open_label' => 'Buka profil kandidat'],
        );
    }

    protected function externalTitle(): string
    {
        return "Pelamar baru untuk {$this->positionTitle()}";
    }
}
