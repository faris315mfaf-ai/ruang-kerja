<?php

namespace App\Listeners\Tasks;

use App\Domain\Google\Events\AttachmentAdded;
use App\Domain\Google\Events\AttachmentRemoved;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Events\Tasks\TaskAttachmentAdded;
use App\Events\Tasks\TaskAttachmentRemoved;
use App\Models\Attachment;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;

/**
 * Attachments of tasks and of their comments: a task attachment adds a
 * timeline entry ("melampirkan Wireframe v2.pdf"); both broadcast on the
 * workspace channel so open details refresh. Comment attachments get no
 * timeline entry — they are shown under the comment itself. Watchers are
 * not notified (the timeline + realtime are enough; see LAMPIRAN-SUMMARY.md).
 */
final class RecordTaskAttachmentChange
{
    public function __construct(private readonly RecordActivity $record) {}

    public function handleAdded(AttachmentAdded $event): void
    {
        $this->apply($event->attachment, $event->userId, added: true);
    }

    public function handleRemoved(AttachmentRemoved $event): void
    {
        $this->apply($event->attachment, $event->userId, added: false);
    }

    private function apply(Attachment $attachment, ?string $userId, bool $added): void
    {
        // A deleted comment (or task) does not resolve: nothing to show.
        $parent = $attachment->attachable;
        $task = match (true) {
            $parent instanceof Task => $parent,
            $parent instanceof Comment => $parent->commentable,
            default => null,
        };

        if (! $task instanceof Task) {
            return;
        }

        if ($parent instanceof Task) {
            $attachment->loadMissing('driveFile');

            $this->record->handle(
                $task->attachmentWorkspace(),
                $task,
                $userId === null ? null : User::query()->find($userId),
                $added ? ActivityEvent::AttachmentAdded : ActivityEvent::AttachmentRemoved,
                [
                    'key' => $task->displayKey(),
                    'title' => $task->title,
                    'attachment_id' => $attachment->id,
                    'filename' => $attachment->filename,
                    'kind' => $attachment->driveFile?->kind->value,
                ],
            );
        }

        $added
            ? TaskAttachmentAdded::dispatch($attachment, $task, $parent)
            : TaskAttachmentRemoved::dispatch($attachment, $task, $parent);
    }
}
