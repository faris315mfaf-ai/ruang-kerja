<?php

namespace App\Events\Tasks;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * "Dibaca oleh" changed: someone's comment read pointer on a task moved
 * forward (MarkCommentsRead). Sent on the presence channel `task.{id}` — only
 * the people who have the task open need it, and they already see each
 * other's id/name/avatar there (routes/channels.php), so the payload carries
 * that identity and the pointer, never comment content.
 */
final class CommentsRead implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  array{id: string, name: string, avatar: string|null}  $user
     */
    public function __construct(
        public string $taskId,
        public array $user,
        public string $lastReadCommentId,
        public string $lastReadAt,
        public string $readAt,
    ) {}

    public function broadcastQueue(): string
    {
        return 'realtime';
    }

    public function broadcastAs(): string
    {
        return 'comment.read';
    }

    /**
     * @return list<PresenceChannel>
     */
    public function broadcastOn(): array
    {
        return [new PresenceChannel('task.'.$this->taskId)];
    }

    /**
     * @return array{task_id: string, user: array{id: string, name: string, avatar: string|null}, last_read_comment_id: string, last_read_at: string, read_at: string}
     */
    public function broadcastWith(): array
    {
        return [
            'task_id' => $this->taskId,
            'user' => $this->user,
            'last_read_comment_id' => $this->lastReadCommentId,
            'last_read_at' => $this->lastReadAt,
            'read_at' => $this->readAt,
        ];
    }
}
