<?php

namespace App\Domain\Tasks\Notifications;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tasks\Services\RichText;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;

/**
 * "Rizky Aditya mengomentari PLQ-21" — to watchers of the task (except the
 * author and people already notified by a mention).
 */
final class TaskCommentedNotification extends TaskNotification
{
    public function __construct(Task $task, public readonly Comment $comment, public readonly User $actor)
    {
        parent::__construct($task);
    }

    public function type(): NotificationType
    {
        return NotificationType::TaskCommented;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $key = $this->key();

        return new NotificationPayload(
            title: "{$this->actor->name} mengomentari {$key}",
            body: RichText::excerpt($this->comment->body, 200),
            url: $this->url('komentar-'.$this->comment->id),
            actor: NotificationActor::fromUser($this->actor),
            subject: $this->subject(),
            meta: self::meta(['quote' => true, 'open_label' => 'Buka tugas', 'comment_id' => $this->comment->id]),
        );
    }
}
