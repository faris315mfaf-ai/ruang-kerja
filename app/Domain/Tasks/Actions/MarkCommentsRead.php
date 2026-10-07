<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Events\Tasks\CommentsRead;
use App\Http\Resources\PersonResource;
use App\Models\Comment;
use App\Models\InboxNotification;
use App\Models\Task;
use App\Models\TaskCommentRead;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The viewer has seen the comments of a task up to $commentId (default: the
 * newest one): moves their read pointer forward — never backwards, so an old
 * tab cannot undo a newer read — marks the Inbox notifications about those
 * comments ("mengomentari", mentions in them) as read, and tells the people
 * who have the task open (CommentsRead). Authorization: TaskPolicy::trackCommentReads.
 */
final class MarkCommentsRead
{
    /**
     * Returns the pointer after the call, null when the task has no comment yet.
     *
     * @return array{user: array{id: string, name: string, avatar: string|null}, last_read_comment_id: string, last_read_at: string, read_at: string}|null
     */
    public function handle(Task $task, User $user, ?string $commentId = null): ?array
    {
        $comment = Comment::withTrashed()
            ->where('commentable_type', $task->getMorphClass())
            ->where('commentable_id', $task->id)
            ->when(
                $commentId !== null,
                fn ($query) => $query->whereKey($commentId),
                fn ($query) => $query->latest('created_at')->latest('id'),
            )
            ->first(['id', 'created_at']);

        if ($comment === null || $comment->created_at === null) {
            if ($commentId !== null) {
                throw ValidationException::withMessages(['comment_id' => 'Komentar tidak ditemukan di tugas ini.']);
            }

            return null;
        }

        $now = now();

        [$advanced, $read] = DB::transaction(function () use ($task, $user, $comment, $now): array {
            // Upsert that only moves forward: (created_at, id) orders comments
            // exactly like the timeline (created_at has second precision).
            $advanced = DB::affectingStatement(
                'INSERT INTO task_comment_reads (task_id, user_id, last_read_comment_id, last_read_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT (task_id, user_id) DO UPDATE SET
                    last_read_comment_id = excluded.last_read_comment_id,
                    last_read_at = excluded.last_read_at,
                    updated_at = excluded.updated_at
                 WHERE (task_comment_reads.last_read_at, task_comment_reads.last_read_comment_id)
                     < (excluded.last_read_at, excluded.last_read_comment_id)',
                [$task->id, $user->id, $comment->id, $comment->created_at, $now, $now],
            ) > 0;

            /** @var TaskCommentRead $read */
            $read = TaskCommentRead::query()
                ->where('task_id', $task->id)
                ->where('user_id', $user->id)
                ->firstOrFail();

            // Inbox: every unread notification about a comment the pointer covers.
            InboxNotification::query()
                ->visibleTo($user)
                ->whereNull('read_at')
                ->where('subject_type', $task->getMorphClass())
                ->where('subject_id', $task->id)
                ->ofType(NotificationType::TaskCommented, NotificationType::Mention)
                ->whereIn('data->meta->comment_id', Comment::withTrashed()
                    ->select('id')
                    ->where('commentable_type', $task->getMorphClass())
                    ->where('commentable_id', $task->id)
                    ->whereRaw('(created_at, id) <= (?, ?)', [$read->last_read_at, $read->last_read_comment_id]))
                ->update(['read_at' => $now, 'updated_at' => $now]);

            return [$advanced, $read];
        });

        $pointer = [
            'user' => PersonResource::from($user),
            'last_read_comment_id' => $read->last_read_comment_id,
            'last_read_at' => $read->last_read_at->toIso8601String(),
            'read_at' => ($read->updated_at ?? $now)->toIso8601String(),
        ];

        if ($advanced) {
            CommentsRead::dispatch($task->id, $pointer['user'], $pointer['last_read_comment_id'], $pointer['last_read_at'], $pointer['read_at']);
        }

        return $pointer;
    }
}
