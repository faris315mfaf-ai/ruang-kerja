<?php

namespace App\Events\Tasks;

use App\Domain\Workspaces\Support\AttachableTypes;
use App\Models\Attachment;
use App\Models\Task;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Attachment added to / removed from a task or one of its comments, on the
 * private channel `workspace.{id}` (same audience as the task events:
 * WorkspacePolicy::view). The payload only carries ids and the task's
 * attachment count: open details reload through their own authorized GET.
 */
abstract class TaskAttachmentBroadcastEvent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public string $taskId;

    public string $workspaceId;

    public string $attachableType;

    public string $attachableId;

    public string $attachmentId;

    public function __construct(Attachment $attachment, Task $task, Model $attachable)
    {
        $this->taskId = $task->id;
        $this->workspaceId = $task->workspace_id;
        $this->attachableType = AttachableTypes::aliasOf($attachable) ?? 'task';
        $this->attachableId = (string) $attachable->getKey();
        $this->attachmentId = $attachment->id;
    }

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
        return [new PrivateChannel('workspace.'.$this->workspaceId)];
    }

    /**
     * @return array{task_id: string, attachable_type: string, attachable_id: string, attachment_id: string, attachments_count: int}
     */
    public function broadcastWith(): array
    {
        return [
            'task_id' => $this->taskId,
            'attachable_type' => $this->attachableType,
            'attachable_id' => $this->attachableId,
            'attachment_id' => $this->attachmentId,
            // Counted when broadcasting (fresh even if several changes queue up).
            'attachments_count' => Attachment::query()
                ->where('attachable_type', (new Task)->getMorphClass())
                ->where('attachable_id', $this->taskId)
                ->count(),
        ];
    }
}
