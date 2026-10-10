<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Queries\TaskDetail;
use App\Domain\Tasks\Services\RichText;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskCommentRequest;
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
 * (web CommentResource, deleted ones stay as "dihapus" tombstones), 30 per
 * page, newest first so page 1 is the live end of the discussion. POST runs
 * the web PostComment behind CommentPolicy::create — the app sends plain
 * text, which becomes the same minimal Tiptap document the web stores, so
 * mentions and watcher notifications behave identically.
 */
class TaskCommentController extends Controller
{
    public function index(#[CurrentUser] User $user, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        /** @var LengthAwarePaginator<int, Comment> $comments */
        $comments = Comment::query()
            ->where('commentable_type', $task->getMorphClass())
            ->where('commentable_id', $task->id)
            ->withTrashed()
            ->with(CommentResource::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(30);

        return response()->json([
            'comments' => CommentResource::collection($comments->items())->resolve(),
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

    public function store(TaskCommentRequest $request, Task $task, #[CurrentUser] User $user, PostComment $post, TaskDetail $detail): JsonResponse
    {
        Gate::authorize('create', [Comment::class, $task]);

        $comment = $post->handle($task, $user, (array) RichText::fromText($request->string('body')->toString()));

        return response()->json(['comment' => $detail->comment($comment)], 201);
    }
}
