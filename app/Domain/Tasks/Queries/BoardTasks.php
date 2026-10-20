<?php

namespace App\Domain\Tasks\Queries;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Tasks of one workspace for the board, list and calendar views: every open
 * task, closed tasks of the last CLOSED_DAYS days, and — for the calendar —
 * every task due inside the visible grid.
 */
final class BoardTasks
{
    public const int CLOSED_DAYS = 30;

    /** Comments older than this never light the "unread" dot of a card. */
    public const int UNREAD_COMMENT_DAYS = 14;

    /**
     * With a $viewer the cards also carry their comment badge (`comments_count`
     * and `has_unread_comments`, see self::withCommentState()) and private
     * tasks of others are left out (Task::scopeRespectingPrivacyOf).
     *
     * @return Builder<Task>
     */
    public static function query(?User $viewer = null): Builder
    {
        $query = Task::query()
            ->with(['workspace:id,key', 'assignees:id', 'labels:id', 'parent:id,number'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ]);

        if ($viewer === null) {
            return $query;
        }

        // Penugasan HR (private tasks): only the viewer's own unless they manage the workspace.
        $query->respectingPrivacyOf($viewer);

        return self::withCommentState($query, $viewer);
    }

    /**
     * Comment badge of a card, as subqueries of the same SELECT (no extra
     * query per card): `comments_count` (not deleted) and `has_unread_comments`
     * — the viewer follows the task (watcher) or is assigned to it, and someone
     * else commented in the last UNREAD_COMMENT_DAYS days after the viewer's
     * read pointer (task_comment_reads; no pointer = nothing read yet).
     *
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public static function withCommentState(Builder $query, User $viewer): Builder
    {
        $morph = (new Task)->getMorphClass();

        return $query
            ->withCount('comments')
            ->selectRaw(
                '(
                    (EXISTS (SELECT 1 FROM task_watchers w WHERE w.task_id = tasks.id AND w.user_id = ?)
                        OR EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = tasks.id AND a.user_id = ?))
                    AND EXISTS (
                        SELECT 1 FROM comments c
                        WHERE c.commentable_type = ? AND c.commentable_id = tasks.id
                          AND c.deleted_at IS NULL AND c.user_id <> ? AND c.created_at >= ?
                          AND NOT EXISTS (
                              SELECT 1 FROM task_comment_reads r
                              WHERE r.task_id = tasks.id AND r.user_id = ?
                                AND (r.last_read_at, r.last_read_comment_id) >= (c.created_at, c.id)
                          )
                    )
                ) AS has_unread_comments',
                [$viewer->id, $viewer->id, $morph, $viewer->id, now()->subDays(self::UNREAD_COMMENT_DAYS), $viewer->id],
            );
    }

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}|null  $dueRange
     * @param  User|null  $viewer  adds the comment badge (self::withCommentState())
     * @return Collection<int, Task>
     */
    public function for(Workspace $workspace, ?array $dueRange = null, ?User $viewer = null): Collection
    {
        $since = now()->subDays(self::CLOSED_DAYS);

        return self::query($viewer)
            ->where('workspace_id', $workspace->id)
            ->where(function (Builder $query) use ($since, $dueRange): void {
                $query->whereNotIn('status_category', TaskStatusCategory::closedValues())
                    ->orWhere('completed_at', '>=', $since)
                    ->orWhere('canceled_at', '>=', $since);

                if ($dueRange !== null) {
                    $query->orWhereBetween('due_date', [$dueRange[0]->toDateString(), $dueRange[1]->toDateString()]);
                }
            })
            ->orderBy('position')
            ->orderBy('number')
            ->get();
    }

    /**
     * Closed tasks hidden by the 30-day window (shown as a hint under the board).
     */
    public function hiddenClosedCount(Workspace $workspace, ?User $viewer = null): int
    {
        $since = now()->subDays(self::CLOSED_DAYS);

        return Task::query()
            ->where('workspace_id', $workspace->id)
            ->when($viewer, fn (Builder $query, User $viewer) => $query->respectingPrivacyOf($viewer))
            ->whereIn('status_category', TaskStatusCategory::closedValues())
            ->where(fn (Builder $query) => $query
                ->whereNull('completed_at')->whereNull('canceled_at')
                ->orWhere('completed_at', '<', $since)
                ->orWhere('canceled_at', '<', $since))
            ->count();
    }
}
