<?php

namespace Tests\Support;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * Sensitive notification: the in-app text names the applicant, the external (push/email) text does not.
 */
final class FakeSensitivePushNotification extends BaseNotification
{
    public function type(): NotificationType
    {
        return NotificationType::HiringDecisionNeeded;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload('Putuskan Budi Santoso (Analis)', 'Nama pelamar', '/hiring/kandidat/01CAND');
    }

    public function externalPayload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload('Ada kandidat yang menunggu keputusan Anda', null, '/hiring/kandidat/01CAND');
    }
}
