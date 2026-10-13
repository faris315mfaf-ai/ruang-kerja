<?php

namespace Tests\Support;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Task;
use App\Models\User;

/**
 * Task-style notification for the push tests: subject = Task with a comment anchor
 * (named class: queued notifications must be serializable).
 */
final class FakeTaskPushNotification extends BaseNotification
{
    public function __construct(public readonly Task $task, public readonly NotificationType $kind = NotificationType::TaskCommented) {}

    public function type(): NotificationType
    {
        return $this->kind;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: 'Komentar baru di TMS-7',
            body: 'Sari: tolong cek angkanya',
            url: '/w/TMS/tasks/7#komentar-01CMT',
            subject: NotificationSubject::fromModel($this->task, 'TMS-7', 'Siapkan laporan'),
        );
    }
}
