<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Services\TaskRichText;
use App\Events\Tasks\CommentUpdated;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Edits a comment (author only, CommentPolicy::update): marks it "diedit",
 * rebuilds mentions and notifies only newly mentioned people.
 */
final class UpdateComment
{
    public function __construct(
        private readonly TaskRichText $richText,
        private readonly SyncMentions $syncMentions,
    ) {}

    /**
     * @param  array<mixed>  $body
     */
    public function handle(Comment $comment, User $author, array $body): Comment
    {
        $task = $comment->commentable;

        if (! $task instanceof Task) {
            abort(404);
        }

        $task->loadMissing('workspace');
        $prepared = $this->richText->prepare($task->workspace, $author, $body);

        if ($prepared['document'] === null) {
            throw ValidationException::withMessages(['body' => 'Komentar tidak boleh kosong.']);
        }

        DB::transaction(function () use ($comment, $task, $author, $prepared): void {
            $changed = $comment->body !== $prepared['document'];

            $comment->forceFill([
                'body' => $prepared['document'],
                'body_text' => $prepared['text'] ?? '',
                'edited_at' => $changed ? now() : $comment->edited_at,
            ])->save();

            $this->syncMentions->handle($task, $comment, $author, $prepared['mentioned_ids']);
        });

        CommentUpdated::dispatch($comment, $task);

        return $comment;
    }
}
