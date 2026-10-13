<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\DeleteComment;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Actions\UpdateComment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskCommentRequest;
use App\Http\Resources\Api\TaskCommentPresenter;
use App\Http\Resources\CommentResource;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Comments of a task for the mobile app. GET lists the timeline's comments
 * (web CommentResource + `body_html`, `mine`, `can`; deleted ones stay as
 * "dihapus" tombstones), 30 per page, newest first so page 1 is the live end
 * of the discussion. POST/PATCH take plain text plus the picked people
 * (`mentions`) and tasks (`task_refs`) — the server builds the same Tiptap
 * document as the web editor — and run the web PostComment / UpdateComment
 * behind CommentPolicy, so watcher and mention notifications behave
 * identically. DELETE soft-deletes (author or workspace admin) and answers
 * with the tombstone.
 */
class TaskCommentController extends Controller
{
    public function __construct(private readonly TaskCommentPresenter $presenter) {}

    public function index(#[CurrentUser] User $user, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        $task->loadMissing('workspace');

        /** @var LengthAwarePaginator<int, Comment> $comments */
        $comments = Comment::query()
            ->where('commentable_type', $task->getMorphClass())
            ->where('commentable_id', $task->id)
            ->withTrashed()
            ->with(CommentResource::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(30);
        $rights = $this->presenter->rights($task, $user);

        return response()->json([
            'comments' => array_map(
                fn (Comment $comment): array => $this->presenter->present($comment, $user, $rights),
                $comments->items(),
            ),
            'can' => $rights,
            'meta' => [
                'current_page' => $comments->currentPage(),
                'from' => $comments->firstItem(),
                'last_page' => $comments->lastPage(),
                'per_page' => $comments->perPage(),
                'to' => $comments->lastItem(),
                'total' => $comments->total(),
            ],
        ]);
    }

    public function store(TaskCommentRequest $request, Task $task, #[CurrentUser] User $user, PostComment $post): JsonResponse
    {
        Gate::authorize('create', [Comment::class, $task]);

        $comment = $post->handle($task, $user, $request->document($user));

        return response()->json(['comment' => $this->presenter->present($comment, $user, $this->presenter->rights($task, $user))], 201);
    }

    public function update(TaskCommentRequest $request, Comment $comment, #[CurrentUser] User $user, UpdateComment $update): JsonResponse
    {
        Gate::authorize('update', $comment);

        $comment = $update->handle($comment, $user, $request->document($user));
        $task = $this->task($comment);

        return response()->json(['comment' => $this->presenter->present($comment, $user, $this->presenter->rights($task, $user))]);
    }

    public function destroy(Comment $comment, #[CurrentUser] User $user, DeleteComment $delete): JsonResponse
    {
        Gate::authorize('view', $comment);
        Gate::authorize('delete', $comment);

        $delete->handle($comment, $user);

        return response()->json(['comment' => $this->presenter->present($comment, $user, $this->presenter->rights($this->task($comment), $user))]);
    }

    private function task(Comment $comment): Task
    {
        $task = $comment->commentable;

        abort_unless($task instanceof Task, 404);
        $task->loadMissing('workspace');

        return $task;
    }
}
