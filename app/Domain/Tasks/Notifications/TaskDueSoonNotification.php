<?php

namespace App\Domain\Tasks\Notifications;

use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Models\User;

/**
 * H-1: "PLQ-21 jatuh tempo besok" (tasks:notify-deadlines).
 */
final class TaskDueSoonNotification extends TaskNotification
{
    public function type(): NotificationType
    {
        return NotificationType::TaskDueSoon;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $due = $this->task->due_date;

        return new NotificationPayload(
            title: "{$this->key()} jatuh tempo besok",
            body: $this->task->title,
            url: $this->url(),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => 'Buka tugas',
                'context' => $due !== null ? 'tenggat '.IndonesianDate::long($due) : null,
                'context_tone' => 'warning',
            ]),
        );
    }
}
