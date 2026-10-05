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
 * "Sari Wulandari menyebut Anda di PLQ-15" (comment or task description).
 * Only sent to people who can see the workspace (SyncMentions).
 */
final class MentionNotification extends TaskNotification
{
    public function __construct(Task $task, public readonly User $actor, public readonly ?Comment $comment = null)
    {
        parent::__construct($task);
    }

    public function type(): NotificationType
    {
        return NotificationType::Mention;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $key = $this->key();
        $body = $this->comment !== null
            ? RichText::excerpt($this->comment->body, 200)
            : RichText::excerpt($this->task->description, 200);

        return new NotificationPayload(
            title: "{$this->actor->name} menyebut Anda di {$key}",
            body: $body !== '' ? $body : $this->task->title,
            url: $this->url($this->comment !== null ? 'komentar-'.$this->comment->id : null),
            actor: NotificationActor::fromUser($this->actor),
            subject: $this->subject(),
            meta: self::meta([
                'quote' => $body !== '',
                'open_label' => 'Buka tugas',
                'context' => $this->comment !== null ? null : 'di deskripsi tugas',
                'comment_id' => $this->comment?->id,
            ]),
        );
    }
}
