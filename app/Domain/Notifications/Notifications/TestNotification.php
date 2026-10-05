<?php

namespace App\Domain\Notifications\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * "Kirim notifikasi uji" from the settings page: lets a user check the bell,
 * toast, Inbox and (if enabled for "Pengumuman & info sistem") email.
 */
final class TestNotification extends BaseNotification
{
    public function type(): NotificationType
    {
        return NotificationType::SystemTest;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: 'Notifikasi uji berhasil',
            body: 'Lonceng, toast, dan Inbox Anda berfungsi. Atur kanal yang Anda inginkan di Pengaturan › Notifikasi.',
            url: '/pengaturan/notifikasi',
            meta: ['open_label' => 'Atur notifikasi'],
        );
    }
}
