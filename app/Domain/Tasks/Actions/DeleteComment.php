<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Events\Tasks\CommentDeleted;
use App\Models\Comment;
use App\Models\InboxNotification;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deletes a comment (author or workspace admin, CommentPolicy::delete).
 * Mentions and reactions of the comment are removed, and so are the Inbox
 * notifications quoting it (comment / mention notifications carry
 * `data.meta.comment_id`) so its text does not outlive it. A moderator deleting
 * someone else's comment is written to audit_logs.
 */
final class DeleteComment
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(Comment $comment, User $actor): void
    {
        $task = $comment->commentable;

        if (! $task instanceof Task) {
            abort(404);
        }

        DB::transaction(function () use ($comment, $actor): void {
            $comment->mentions()->delete();
            $comment->reactions()->delete();
            InboxNotification::query()->where('data->meta->comment_id', $comment->id)->delete();
            $comment->delete();

            if ($comment->user_id !== $actor->id) {
                $this->audit->log('comment.deleted', $comment, ['user_id' => $comment->user_id, 'body_text' => $comment->body_text], null, $actor);
            }
        });

        CommentDeleted::dispatch($comment, $task);
    }
}
