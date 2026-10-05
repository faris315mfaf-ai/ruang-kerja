<?php

namespace App\Events\Tasks;

use App\Http\Resources\CommentResource;
use App\Models\Comment;
use App\Models\Task;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Comment events on the private channel `workspace.{id}` (same audience as
 * the task events: WorkspacePolicy::view). Dispatched after commit; the
 * payload is rebuilt fresh (deleted comments included) when broadcasting.
 */
abstract class CommentBroadcastEvent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Comment $comment, public Task $task) {}

    /**
     * Dedicated queue with its own Horizon worker (config/horizon.php
     * `supervisor-realtime`): broadcasts never wait behind mail jobs.
     */
    public function broadcastQueue(): string
    {
        return 'realtime';
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('workspace.'.$this->task->workspace_id)];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $comment = Comment::withTrashed()->with(['author', 'reactions.user'])->find($this->comment->id) ?? $this->comment;

        return [
            'task_id' => $this->task->id,
            'comment' => (new CommentResource($comment))->resolve(),
        ];
    }
}
