<?php

namespace App\Listeners;

use App\Domain\Tasks\Notifications\TaskAssignedNotification;
use App\Domain\Tasks\Services\TaskAudience;
use App\Events\Tasks\TaskAssigneesAdded;
use Illuminate\Support\Facades\Notification;

/**
 * Notifies new assignees (not the actor assigning themselves).
 */
final class SendTaskAssignedNotifications
{
    public function __construct(private readonly TaskAudience $audience) {}

    public function handle(TaskAssigneesAdded $event): void
    {
        $task = $event->task->loadMissing('workspace');
        $ids = array_values(array_diff($event->userIds, [$event->actor->id]));
        $recipients = $this->audience->withAccess($task->workspace, $ids);

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients->all(), new TaskAssignedNotification($task, $event->actor));
        }
    }
}
