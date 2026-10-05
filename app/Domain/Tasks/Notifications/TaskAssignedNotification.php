<?php

namespace App\Domain\Tasks\Notifications;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Models\Task;
use App\Models\User;

/**
 * "Dimas Pratama menugaskan PLQ-27 kepada Anda". Opens the task; the Inbox
 * also offers "Rencanakan di Ruang saya" (meta plan_url → Beranda).
 */
final class TaskAssignedNotification extends TaskNotification
{
    public const string PLAN_URL = '/dashboard/saya#ruang-saya';

    public function __construct(Task $task, public readonly User $actor)
    {
        parent::__construct($task);
    }

    public function type(): NotificationType
    {
        return NotificationType::TaskAssigned;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $key = $this->key();
        $due = $this->task->due_date;

        return new NotificationPayload(
            title: "{$this->actor->name} menugaskan {$key} kepada Anda",
            body: $this->task->title,
            url: $this->url(),
            actor: NotificationActor::fromUser($this->actor),
            subject: $this->subject(),
            meta: self::meta([
                'open_label' => 'Buka tugas',
                'context' => $due !== null ? 'tenggat '.IndonesianDate::short($due) : null,
                // Second action in the Inbox: accept it into "Ruang saya" on Beranda.
                'plan_url' => self::PLAN_URL,
                'plan_label' => 'Rencanakan di Ruang saya',
            ]),
        );
    }
}
