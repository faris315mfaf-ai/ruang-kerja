<?php

namespace App\Policies;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Comments follow their task (TaskPolicy): invisible → 404. Editing is for
 * the author only; deleting (soft) for the author or a workspace admin
 * (owner/admin role, or Super Admin managing shared workspaces).
 */
class CommentPolicy
{
    public function __construct(
        private readonly TaskPolicy $tasks,
        private readonly WorkspacePolicy $workspaces,
    ) {}

    /**
     * Lists are always scoped to one task (or Comment::visibleTo()).
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Comment $comment): Response
    {
        $task = self::task($comment);

        return $task === null ? Response::denyAsNotFound() : $this->tasks->view($user, $task);
    }

    public function create(User $user, Task $task): Response
    {
        return $this->tasks->comment($user, $task);
    }

    public function update(User $user, Comment $comment): Response
    {
        return $this->guard($user, $comment, fn (): bool => $comment->user_id === $user->id, 'Hanya penulis yang dapat mengubah komentar ini.');
    }

    public function delete(User $user, Comment $comment): Response
    {
        return $this->guard($user, $comment, function () use ($user, $comment): bool {
            if ($comment->user_id === $user->id) {
                return true;
            }

            $workspace = self::task($comment)?->workspace;

            return $workspace !== null
                && ($workspace->roleOf($user)?->atLeast(WorkspaceRole::Admin) === true || $this->workspaces->canManage($user, $workspace));
        }, 'Hanya penulis atau admin workspace yang dapat menghapus komentar ini.');
    }

    public function react(User $user, Comment $comment): Response
    {
        $task = self::task($comment);

        if ($task === null || $comment->trashed()) {
            return Response::denyAsNotFound();
        }

        return $this->tasks->comment($user, $task);
    }

    /**
     * @param  callable(): bool  $allowed
     */
    private function guard(User $user, Comment $comment, callable $allowed, string $message): Response
    {
        $task = self::task($comment);

        if ($task === null || $comment->trashed()) {
            return Response::denyAsNotFound();
        }

        $canComment = $this->tasks->comment($user, $task);

        if ($canComment->denied()) {
            return $canComment;
        }

        return $allowed() ? Response::allow() : Response::deny($message);
    }

    private static function task(Comment $comment): ?Task
    {
        $task = $comment->commentable;

        return $task instanceof Task ? $task : null;
    }
}
