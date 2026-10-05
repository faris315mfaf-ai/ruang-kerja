<?php

namespace App\Domain\Tasks\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Models\Task;

/**
 * Shared helpers of the task notifications (subject = the task, link = the
 * full-screen task detail /w/{KEY}/tasks/{n}).
 */
abstract class TaskNotification extends BaseNotification
{
    public function __construct(public readonly Task $task) {}

    protected function key(): string
    {
        $this->task->loadMissing('workspace:id,key');

        return $this->task->displayKey();
    }

    protected function subject(): NotificationSubject
    {
        return NotificationSubject::fromModel($this->task, $this->key(), $this->task->title);
    }

    /**
     * Drops null values (the Inbox only understands scalar meta values).
     *
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    protected static function meta(array $meta): array
    {
        return array_filter($meta, fn (mixed $value): bool => $value !== null);
    }

    protected function url(?string $anchor = null): string
    {
        $this->task->loadMissing('workspace:id,key');

        return $this->task->url().($anchor !== null ? '#'.$anchor : '');
    }
}
