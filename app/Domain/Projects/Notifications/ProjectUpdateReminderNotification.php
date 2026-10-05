<?php

namespace App\Domain\Projects\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;
use App\Models\Workspace;

/**
 * Friday 15.00 reminder to the PIC when the project has no update this week
 * (SendProjectUpdateReminders).
 */
final class ProjectUpdateReminderNotification extends BaseNotification
{
    public function __construct(public readonly Workspace $workspace) {}

    public function type(): NotificationType
    {
        return NotificationType::ProjectUpdateReminder;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "Tulis update mingguan {$this->workspace->name}",
            body: 'Belum ada update proyek minggu ini. Isi status, ringkasan, hambatan, dan keputusan yang dibutuhkan dari Direksi.',
            url: "/w/{$this->workspace->key}/ringkasan?update=1",
            subject: NotificationSubject::fromModel($this->workspace, $this->workspace->key, $this->workspace->name),
            meta: ['open_label' => 'Tulis update', 'context' => 'Jumat 15.00', 'context_tone' => 'warning'],
        );
    }
}
