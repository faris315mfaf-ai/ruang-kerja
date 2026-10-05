<?php

namespace App\Domain\Tasks\Queries;

use App\Domain\Google\Queries\AttachmentList;
use App\Domain\Tasks\Services\MentionParser;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Resources\CommentResource;
use App\Http\Resources\LabelResource;
use App\Http\Resources\PersonResource;
use App\Http\Resources\TaskResource;
use App\Http\Resources\TaskStatusResource;
use App\Http\Resources\WorkspaceResource;
use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\Task;
use App\Models\User;
use App\Policies\TaskPolicy;
use App\Policies\WorkspacePolicy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Everything the task detail (TaskSheet, full-screen page, mobile
 * MTaskDetail, Inbox preview) shows for one task, as seen by $viewer:
 * properties, sub-tasks, checklist, watchers, Drive attachments (task-level,
 * viewer-specific rights; comment attachments ride on each comment), and the
 * unified timeline of activities + comments (oldest first). Shape mirrors
 * resources/js/features/tasks/detail/types.ts `TaskDetail`.
 */
final class TaskDetail
{
    /** Newest timeline entries kept (comments + activities). */
    public const int TIMELINE_LIMIT = 300;

    public function __construct(
        private readonly WorkspacePage $page,
        private readonly TaskPolicy $tasks,
        private readonly WorkspacePolicy $workspaces,
        private readonly MentionParser $parser,
        private readonly AttachmentList $attachments,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(Task $task, User $viewer): array
    {
        /** @var Task $task */
        $task = BoardTasks::query()
            ->with([
                'workspace',
                'status',
                'creator:id,name,avatar_url',
                'assignees:id,name,avatar_url',
                'watchers:id,name,avatar_url',
                'parent:id,workspace_id,number,title,status_category',
            ])
            ->whereKey($task->id)
            ->firstOrFail();
        $workspace = $task->workspace;

        $subtasks = Task::query()
            ->where('parent_id', $task->id)
            ->with(['assignees:id', 'labels:id', 'workspace:id,key', 'parent:id,number'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ])
            ->orderBy('number')
            ->get();

        $comments = $this->recentComments($task);
        $timeline = $this->timeline($task, $comments);
        $references = $this->references($task, $viewer, $comments, $timeline);
        $attachments = $this->attachments->for($task, $viewer);

        return [
            'task' => [
                ...(new TaskResource($task))->resolve(),
                'description' => $task->description,
                'updated_at' => $task->updated_at?->toIso8601String(),
                'started_at' => $task->started_at?->toIso8601String(),
                'attachments_count' => count($attachments['attachments']),
            ],
            'url' => $task->url(),
            'workspace' => WorkspaceResource::reference($workspace),
            'statuses' => TaskStatusResource::collection($workspace->statuses()->get())->resolve(),
            'labels' => LabelResource::collection($workspace->labels()->get())->resolve(),
            'members' => $this->page->members($workspace),
            'creator' => $task->creator !== null ? PersonResource::from($task->creator) : null,
            'assignees' => $task->assignees->map(fn (User $user): array => PersonResource::from($user))->values()->all(),
            'watchers' => $task->watchers->map(fn (User $user): array => PersonResource::from($user))->values()->all(),
            'watching' => $task->watchers->contains('id', $viewer->id),
            'parent' => $task->parent !== null ? [
                'id' => $task->parent->id,
                'key' => $workspace->key.'-'.$task->parent->number,
                'title' => $task->parent->title,
                'status_category' => $task->parent->status_category->value,
            ] : null,
            'subtasks' => TaskResource::collection($subtasks)->resolve(),
            'checklist' => ChecklistItem::query()->where('task_id', $task->id)->orderBy('position')->get()
                ->map(fn (ChecklistItem $item): array => [
                    'id' => $item->id,
                    'title' => $item->title,
                    'is_done' => $item->is_done,
                    'position' => $item->position,
                    'done_by' => $item->done_by,
                    'done_at' => $item->done_at?->toIso8601String(),
                ])->values()->all(),
            'attachments' => $attachments,
            'timeline' => $timeline,
            'references' => $references,
            'reactions' => Reaction::EMOJI,
            'can' => [
                'edit' => $this->tasks->update($viewer, $task)->allowed(),
                'delete' => $this->tasks->delete($viewer, $task)->allowed(),
                'comment' => $this->tasks->comment($viewer, $task)->allowed(),
                'moderate' => $this->workspaces->canManage($viewer, $workspace) && ! $workspace->isArchived(),
            ],
        ];
    }

    /**
     * Single comment as the viewer sees it (after post/edit).
     *
     * @return array<string, mixed>
     */
    public function comment(Comment $comment): array
    {
        $comment->loadMissing(CommentResource::RELATIONS);

        return (new CommentResource($comment))->resolve();
    }

    /**
     * Activities and comments, oldest first.
     *
     * @param  Collection<int, Comment>  $comments
     * @return list<array<string, mixed>>
     */
    private function timeline(Task $task, Collection $comments): array
    {
        $activities = Activity::query()
            ->where('subject_type', $task->getMorphClass())
            ->where('subject_id', $task->id)
            ->with('causer:id,name,avatar_url')
            ->latest('created_at')
            ->limit(self::TIMELINE_LIMIT)
            ->get()
            ->map(fn (Activity $activity): array => [
                'kind' => 'activity',
                'id' => $activity->id,
                'event' => $activity->event,
                'properties' => $activity->properties ?? [],
                'causer' => $activity->causer !== null ? PersonResource::from($activity->causer) : null,
                'created_at' => $activity->created_at->toIso8601String(),
            ]);

        $resolved = $comments->map(fn (Comment $comment): array => (new CommentResource($comment))->resolve());

        /** @var list<array<string, mixed>> */
        return $activities->concat($resolved)
            ->sortBy(fn (array $item): string => is_string($item['created_at'] ?? null) ? $item['created_at'].$item['id'] : '')
            ->slice(-self::TIMELINE_LIMIT)
            ->values()
            ->all();
    }

    /**
     * The latest comments (deleted ones included, shown as "dihapus"), loaded
     * once for the timeline and the references.
     *
     * @return Collection<int, Comment>
     */
    private function recentComments(Task $task): Collection
    {
        return Comment::withTrashed()
            ->where('commentable_type', $task->getMorphClass())
            ->where('commentable_id', $task->id)
            ->with(CommentResource::RELATIONS)
            ->latest('created_at')
            ->limit(self::TIMELINE_LIMIT)
            ->get();
    }

    /**
     * #KEY-n references inside the description and the comments shown in the
     * timeline that the viewer may see (others render as plain text), keyed by
     * task id. Comments outside the timeline or deleted are not parsed.
     *
     * @param  Collection<int, Comment>  $comments
     * @param  list<array<string, mixed>>  $timeline
     * @return array<string, array{key: string, title: string, status_category: string, url: string}>
     */
    private function references(Task $task, User $viewer, Collection $comments, array $timeline): array
    {
        $ids = $this->parser->taskIds($task->description);
        $shown = [];

        foreach ($timeline as $item) {
            if (($item['kind'] ?? null) === 'comment' && is_string($item['id'] ?? null)) {
                $shown[$item['id']] = true;
            }
        }

        foreach ($comments as $comment) {
            if (isset($shown[$comment->id]) && ! $comment->trashed()) {
                $ids = [...$ids, ...$this->parser->taskIds($comment->body)];
            }
        }

        if ($ids === []) {
            return [];
        }

        return Task::query()
            ->visibleTo($viewer)
            ->whereIn('tasks.id', array_values(array_unique($ids)))
            ->with('workspace:id,key')
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category'])
            ->mapWithKeys(fn (Task $reference): array => [$reference->id => [
                'key' => $reference->displayKey(),
                'title' => $reference->title,
                'status_category' => $reference->status_category->value,
                'url' => $reference->url(),
            ]])
            ->all();
    }
}
