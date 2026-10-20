<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Notifications\TaskCommentedNotification;
use App\Domain\Tasks\Services\TaskAudience;
use App\Domain\Tasks\Services\TaskRelations;
use App\Domain\Tasks\Services\TaskRichText;
use App\Events\Tasks\CommentPosted;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Adds a comment to a task (docs/ARCHITECTURE.md §3.5): sanitized Tiptap
 * JSON → mentions (+ notifications for people with access) → the author
 * becomes a watcher → other watchers get "mengomentari" → CommentPosted.
 */
final class PostComment
{
    public function __construct(
        private readonly TaskRichText $richText,
        private readonly SyncMentions $syncMentions,
        private readonly TaskRelations $relations,
        private readonly TaskAudience $audience,
    ) {}

    /**
     * @param  array<mixed>  $body  Tiptap document
     */
    public function handle(Task $task, User $author, array $body): Comment
    {
        $task->loadMissing('workspace');
        $prepared = $this->richText->prepare($task->workspace, $author, $body);

        if ($prepared['document'] === null) {
            throw ValidationException::withMessages(['body' => 'Komentar tidak boleh kosong.']);
        }

        $comment = DB::transaction(function () use ($task, $author, $prepared): Comment {
            $comment = $task->comments()->create([
                'user_id' => $author->id,
                'body' => $prepared['document'],
                'body_text' => $prepared['text'] ?? '',
            ]);

            $notified = $this->syncMentions->handle($task, $comment, $author, $prepared['mentioned_ids']);

            /** @var list<string> $watcherIds */
            $watcherIds = $task->watchers()->pluck('users.id')->all();
            $this->relations->watch($task, [$author->id], now());

            $others = array_values(array_diff($watcherIds, [$author->id], $notified));
            $recipients = $this->audience->withTaskAccess($task, $others);

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients->all(), new TaskCommentedNotification($task, $comment, $author));
            }

            return $comment;
        });

        CommentPosted::dispatch($comment, $task);

        return $comment;
    }
}
