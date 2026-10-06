<?php

namespace App\Domain\Automation\Notifications;

use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tasks\Notifications\TaskNotification;
use App\Models\Task;
use App\Models\User;

/**
 * "Otomasi: Review ke Kepala Divisi · OPS-112 pindah ke kolom Review".
 * Sent by the "beri tahu" action of an automation rule (type
 * `automation.notify`, preference row "Otomasi workspace"). The rule name
 * and reason are copied as text so a later deleted rule does not drop it.
 */
final class AutomationNotification extends TaskNotification
{
    public function __construct(Task $task, public readonly string $ruleName, public readonly string $reason)
    {
        parent::__construct($task);
    }

    public function type(): NotificationType
    {
        return NotificationType::AutomationNotify;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $key = $this->key();

        return new NotificationPayload(
            title: "Otomasi \"{$this->ruleName}\": {$key} {$this->reason}",
            body: $this->task->title,
            url: $this->url(),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => 'Buka tugas',
                'context' => 'aturan otomasi',
            ]),
        );
    }
}
