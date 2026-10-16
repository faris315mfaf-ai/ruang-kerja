<?php

namespace App\Http\Resources\Api;

use App\Domain\Notes\Services\NoteHtml;
use App\Domain\Tasks\Queries\TaskApiDetail;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Http\Resources\CommentResource;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Policies\TaskPolicy;
use App\Policies\WorkspacePolicy;

/**
 * A task comment as the mobile app shows it: the web CommentResource (Tiptap
 * `body`, `body_text`, reactions, attachments) plus `body_html` (safe HTML of
 * the document, mentions and #rujukan as `data-*` spans), `mine`,
 * `my_reactions` and what the viewer may do with it (`can`).
 *
 * `can` is derived from the task-level answers of the policies — one
 * TaskPolicy::comment and one moderator check per request instead of a
 * CommentPolicy round trip per comment — and follows CommentPolicy exactly:
 * edit = author, delete = author or workspace admin/manager, react = anyone
 * who may comment; nothing on a deleted comment.
 */
final class TaskCommentPresenter
{
    public function __construct(
        private readonly TaskPolicy $tasks,
        private readonly WorkspacePolicy $workspaces,
    ) {}

    /**
     * Task-level rights for the viewer, computed once per request.
     *
     * @return array{comment: bool, moderate: bool}
     */
    public function rights(Task $task, User $viewer): array
    {
        $workspace = $task->workspace;

        return [
            'comment' => $this->tasks->comment($viewer, $task)->allowed(),
            'moderate' => $workspace->roleOf($viewer)?->atLeast(WorkspaceRole::Admin) === true
                || $this->workspaces->canManage($viewer, $workspace),
        ];
    }

    /**
     * @param  array{comment: bool, moderate: bool}  $rights
     * @return array<string, mixed>
     */
    public function present(Comment $comment, User $viewer, array $rights): array
    {
        $comment->loadMissing(CommentResource::RELATIONS);
        $row = (new CommentResource($comment))->resolve();
        $deleted = (bool) ($row['deleted'] ?? false);
        $mine = $comment->user_id === $viewer->id;
        $body = is_array($row['body'] ?? null) ? $row['body'] : null;
        $reactions = is_array($row['reactions'] ?? null) ? $row['reactions'] : [];

        return [
            ...$row,
            'body_html' => $body === null ? null : NoteHtml::toHtml($body),
            'attachments' => array_map(
                fn (array $attachment): array => TaskApiDetail::attachment($attachment),
                array_values(array_filter((array) ($row['attachments'] ?? []), 'is_array')),
            ),
            'mine' => $mine,
            'my_reactions' => array_values(array_map(
                fn (array $group): string => (string) $group['emoji'],
                array_filter($reactions, fn (mixed $group): bool => is_array($group) && in_array($viewer->id, (array) ($group['user_ids'] ?? []), true)),
            )),
            'can' => [
                'edit' => ! $deleted && $mine && $rights['comment'],
                'delete' => ! $deleted && $rights['comment'] && ($mine || $rights['moderate']),
                'react' => ! $deleted && $rights['comment'],
            ],
        ];
    }
}
