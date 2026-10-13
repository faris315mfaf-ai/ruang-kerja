<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\MarkCommentsRead;
use App\Domain\Tasks\Queries\CommentReads;
use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkspaceMember;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * "Dibaca oleh": the read pointer of the comments. POST moves the caller's
 * pointer forward (MarkCommentsRead — never backwards; also clears the Inbox
 * notifications about those comments) behind TaskPolicy::trackCommentReads, so
 * management in "lihat saja" mode is neither recorded nor listed. GET lists who
 * still takes part in the task and how far they read (CommentReads): active
 * employees who can see the workspace, never view-only management.
 */
class TaskCommentReadController extends Controller
{
    public function store(Request $request, Task $task, #[CurrentUser] User $user, MarkCommentsRead $markRead): JsonResponse
    {
        Gate::authorize('trackCommentReads', $task);

        $data = $request->validate(['comment_id' => ['nullable', 'string', 'size:26']], ['comment_id.size' => 'Komentar tidak valid.']);
        $commentId = $data['comment_id'] ?? null;

        return response()->json(['read' => $markRead->handle($task, $user, is_string($commentId) ? strtolower($commentId) : null)]);
    }

    public function index(Task $task, #[CurrentUser] User $user, CommentReads $reads): JsonResponse
    {
        Gate::authorize('view', $task);

        $task->loadMissing('workspace');
        $members = WorkspaceMember::query()->where('workspace_id', $task->workspace_id)->pluck('user_id')->all();

        return response()->json([
            // False for view-only management: their own reading is not recorded.
            'tracking' => Gate::forUser($user)->allows('trackCommentReads', $task),
            'readers' => $reads->forTask($task, $task->workspace, array_values($members)),
        ]);
    }
}
