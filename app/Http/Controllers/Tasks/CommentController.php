<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Actions\DeleteComment;
use App\Domain\Tasks\Actions\MarkCommentsRead;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Actions\ToggleReaction;
use App\Domain\Tasks\Actions\UpdateComment;
use App\Domain\Tasks\Queries\TaskDetail;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tasks\CommentRequest;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Comments of a task (JSON API used by the task detail): post, edit (author),
 * soft delete (author or workspace admin), emoji reactions and the read
 * pointer ("Dibaca oleh").
 */
class CommentController extends Controller
{
    public function store(CommentRequest $request, Task $task, #[CurrentUser] User $user, PostComment $post, TaskDetail $detail): JsonResponse
    {
        Gate::authorize('create', [Comment::class, $task]);

        $comment = $post->handle($task, $user, $request->body());

        return response()->json(['comment' => $detail->comment($comment)], 201);
    }

    public function update(CommentRequest $request, Comment $comment, #[CurrentUser] User $user, UpdateComment $update, TaskDetail $detail): JsonResponse
    {
        Gate::authorize('update', $comment);

        $comment = $update->handle($comment, $user, $request->body());

        return response()->json(['comment' => $detail->comment($comment)]);
    }

    public function destroy(Comment $comment, #[CurrentUser] User $user, DeleteComment $delete, TaskDetail $detail): JsonResponse
    {
        Gate::authorize('delete', $comment);

        $delete->handle($comment, $user);

        return response()->json(['comment' => $detail->comment($comment)]);
    }

    /**
     * "Dibaca": the viewer has seen the comments up to `comment_id` (default:
     * the newest). Called (debounced) by the task detail when its comments
     * are on screen; returns the viewer's pointer after the call.
     */
    public function read(Request $request, Task $task, #[CurrentUser] User $user, MarkCommentsRead $markRead): JsonResponse
    {
        Gate::authorize('trackCommentReads', $task);

        $data = $request->validate(['comment_id' => ['nullable', 'string', 'ulid']]);

        $commentId = $data['comment_id'] ?? null;

        return response()->json(['read' => $markRead->handle($task, $user, is_string($commentId) ? strtolower($commentId) : null)]);
    }

    public function react(Request $request, Comment $comment, #[CurrentUser] User $user, ToggleReaction $toggle, TaskDetail $detail): JsonResponse
    {
        Gate::authorize('react', $comment);

        $data = $request->validate(
            ['emoji' => ['required', 'string', Rule::in(Reaction::EMOJI)]],
            ['emoji.in' => 'Reaksi tidak tersedia.'],
        );

        $added = $toggle->handle($comment, $user, (string) $data['emoji']);
        $comment->unsetRelation('reactions');

        return response()->json(['added' => $added, 'comment' => $detail->comment($comment)]);
    }
}
