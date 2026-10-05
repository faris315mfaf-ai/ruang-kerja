<?php

namespace App\Domain\Tasks\Notifications;

use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Task;
use App\Models\User;

/**
 * "OPS-127 melewati tenggat" — "Perlu tindakan" until the task is closed or
 * its due date moves to the future (ResolveTaskDeadlineNotifications).
 */
final class TaskOverdueNotification extends TaskNotification
{
    public function __construct(Task $task, public readonly int $daysLate)
    {
        parent::__construct($task);
    }

    public function type(): NotificationType
    {
        return NotificationType::TaskOverdue;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->key()} melewati tenggat",
            body: $this->task->title,
            url: $this->url(),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => 'Buka tugas',
                'context' => 'lewat '.max(1, $this->daysLate).' hari',
                'context_tone' => 'danger',
            ]),
        );
    }
}
