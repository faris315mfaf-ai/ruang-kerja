<?php

namespace App\Domain\Tasks\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Google\Queries\AttachmentList;
use App\Domain\Notes\Services\NoteHtml;
use App\Domain\Tasks\Services\ActivityText;
use App\Http\Resources\Api\TaskListRow;
use App\Http\Resources\Api\TaskSummary;
use App\Http\Resources\LabelResource;
use App\Http\Resources\PersonResource;
use App\Http\Resources\TaskStatusResource;
use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\TaskPolicy;
use App\Policies\WorkspacePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Gate;

/**
 * The full task detail of the mobile app (GET /tugas/{task}, and the answer
 * of every task write): everything the detail screen shows in one request,
 * as seen by $viewer — properties, status track, description (plain text and
 * safe HTML), people, labels, checklist, sub-tasks, attachments, watchers,
 * an activity preview, the comment counter, the viewer's own plan and the
 * rights (`can`) with the reason for every closed one (`locked_reason`) and a
 * banner for the three read-only situations (titipan · lihat saja · arsip).
 *
 * Comments, the full activity feed and "Dibaca oleh" have their own paged
 * endpoints. Always re-reads the task, so the rights are fresh after a write.
 */
final class TaskApiDetail
{
    /** Newest activity entries in the preview. */
    public const int ACTIVITY_PREVIEW = 5;

    /** Abilities of `can` → TaskPolicy method. */
    private const array ABILITIES = [
        'edit' => 'update',
        'delete' => 'delete',
        'comment' => 'comment',
        'work' => 'work',
        'plan' => 'plan',
        'move' => 'move',
        'watch' => 'watch',
        'track_reads' => 'trackCommentReads',
    ];

    public function __construct(
        private readonly WorkspacePolicy $workspaces,
        private readonly AttachmentList $attachments,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(Task $task, User $viewer): array
    {
        $task = BoardTasks::query($viewer)
            ->with([
                'workspace' => function (Relation $relation) use ($viewer): void {
                    /** @var Builder<Workspace> $query */
                    $query = $relation->getQuery();
                    $query->withMembershipOf($viewer);
                },
                'status:id,workspace_id,name,category',
                'creator:id,name,avatar_url',
                'assignees:id,name,avatar_url',
                'watchers:id,name,avatar_url',
                'labels',
                'parent:id,workspace_id,number,title,status_category',
            ])
            ->whereKey($task->id)
            ->firstOrFail();

        $workspace = $task->workspace;
        $today = Period::officeDate(now());
        $abilities = $this->abilities($task, $viewer);
        $attachments = $this->attachments->for($task, $viewer);
        $plan = TaskPlan::query()->ownedBy($viewer)->where('task_id', $task->id)->first();
        $attributes = $task->getAttributes();

        return [
            'task' => [
                ...TaskSummary::detail($task),
                'number' => $task->number,
                'workspace' => [
                    'id' => $workspace->id,
                    'key' => $workspace->key,
                    'name' => $workspace->name,
                    'type' => $workspace->type->value,
                    'archived' => $workspace->isArchived(),
                ],
                'description_html' => $task->description !== null ? NoteHtml::toHtml($task->description) : null,
                // false = marks, lists or mentions the plain-text editor would flatten.
                'description_plain' => NoteHtml::isMobileEditable($task->description),
                'estimate_hours' => $task->estimate_hours === null ? null : (float) $task->estimate_hours,
                'started_at' => $task->started_at?->toIso8601String(),
                'updated_at' => $task->updated_at?->toIso8601String(),
                'creator' => $task->creator !== null ? PersonResource::from($task->creator) : null,
                'parent' => $task->parent !== null ? [
                    'id' => $task->parent->id,
                    'key' => $workspace->key.'-'.$task->parent->number,
                    'title' => $task->parent->title,
                    'status_category' => $task->parent->status_category->value,
                ] : null,
                'statuses' => TaskStatusResource::collection($workspace->statuses()->get())->resolve(),
                'status_id' => $task->status_id,
                'assignee_people' => $task->assignees->map(fn (User $user): array => PersonResource::from($user))->values()->all(),
                'labels' => $task->labels->map(fn (Label $label): array => LabelResource::make($label)->resolve())->values()->all(),
                'workspace_labels' => LabelResource::collection($workspace->labels()->get())->resolve(),
                'checklist_items' => $this->checklist($task),
                'subtasks' => $this->subtasks($task, $today),
                'attachments' => array_map(self::attachment(...), $attachments['attachments']),
                'attachments_can_edit' => $attachments['can_edit'],
                'drive' => $attachments['drive'],
                'watchers' => $task->watchers->map(fn (User $user): array => PersonResource::from($user))->values()->all(),
                'am_watching' => $task->watchers->contains('id', $viewer->id),
                'activity_preview' => $this->activity($task, self::ACTIVITY_PREVIEW),
                'comments' => [
                    'count' => (int) ($attributes['comments_count'] ?? 0),
                    'unread' => (bool) ($attributes['has_unread_comments'] ?? false),
                ],
                'plan' => [
                    'bucket' => $plan?->bucket?->value,
                    'planned_for' => $plan?->planned_for?->toDateString(),
                ],
                'view_only' => $this->workspaces->isViewOnly($viewer, $workspace),
                'can' => $abilities['can'],
                'locked_reason' => $abilities['locked_reason'],
                'banner' => $this->banner($task, $viewer, $abilities),
            ],
        ];
    }

    /**
     * Rights of $viewer on $task, with the policy's message for every closed
     * one (null while open, or when the task would be a 404 anyway).
     *
     * @return array{can: array<string, bool>, locked_reason: array<string, string|null>}
     */
    public function abilities(Task $task, User $viewer): array
    {
        $gate = Gate::forUser($viewer);
        $can = [];
        $locked = [];

        foreach (self::ABILITIES as $name => $ability) {
            $response = $gate->inspect($ability, $task);
            $can[$name] = $response->allowed();
            $locked[$name] = $response->allowed() || $response->status() === 404
                ? null
                : ($response->message() ?: 'Anda tidak punya izin untuk tindakan ini.');
        }

        $can['moderate'] = $this->workspaces->canManage($viewer, $task->workspace) && ! $task->workspace->isArchived();

        return ['can' => $can, 'locked_reason' => $locked];
    }

    /**
     * Activity feed entries, newest first.
     *
     * @return list<array<string, mixed>>
     */
    public function activity(Task $task, int $limit): array
    {
        $activities = Activity::query()
            ->where('subject_type', $task->getMorphClass())
            ->where('subject_id', $task->id)
            ->with('causer:id,name,avatar_url')
            ->latest('created_at')
            ->latest('id')
            ->limit($limit)
            ->get();

        return self::activities(array_values($activities->all()));
    }

    /**
     * @param  list<Activity>  $activities
     * @return list<array<string, mixed>>
     */
    public static function activities(array $activities): array
    {
        $ids = array_values(array_unique(array_merge(...array_map(
            fn (Activity $activity): array => ActivityText::userIds($activity->properties ?? []),
            $activities,
        ) ?: [[]])));
        $names = $ids === [] ? [] : User::query()->whereIn('id', $ids)->pluck('name', 'id')->all();

        return array_map(fn (Activity $activity): array => [
            'id' => $activity->id,
            'event' => $activity->event,
            'text' => ActivityText::describe($activity->event, $activity->properties ?? [], $names),
            'properties' => $activity->properties ?? [],
            'causer' => $activity->causer !== null ? PersonResource::from($activity->causer) : null,
            'created_at' => $activity->created_at->toIso8601String(),
        ], $activities);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function checklist(Task $task): array
    {
        return array_values(ChecklistItem::query()->where('task_id', $task->id)->orderBy('position')->orderBy('id')->get()
            ->map(fn (ChecklistItem $item): array => self::checklistItem($item))
            ->all());
    }

    /**
     * @return array<string, mixed>
     */
    public static function checklistItem(ChecklistItem $item): array
    {
        return [
            'id' => $item->id,
            'title' => $item->title,
            'is_done' => $item->is_done,
            'position' => $item->position,
            'done_by' => $item->done_by,
            'done_at' => $item->done_at?->toIso8601String(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function subtasks(Task $task, CarbonImmutable $today): array
    {
        return array_values(Task::query()
            ->where('parent_id', $task->id)
            ->with(['workspace:id,key,name,type', 'status:id,workspace_id,name,category', 'assignees:id,name,avatar_url', 'labels'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ])
            ->orderBy('number')
            ->get()
            ->map(fn (Task $subtask): array => TaskListRow::make($subtask, $today))
            ->all());
    }

    /**
     * One attachment as the app lists it.
     *
     * @param  array<string, mixed>  $attachment  AttachmentResource + can_remove
     * @return array<string, mixed>
     */
    public static function attachment(array $attachment): array
    {
        $file = is_array($attachment['drive_file'] ?? null) ? $attachment['drive_file'] : null;
        $mime = is_string($attachment['mime_type'] ?? null) ? $attachment['mime_type'] : '';

        return [
            'id' => $attachment['id'],
            'name' => $attachment['filename'],
            'kind' => $file['kind'] ?? match (true) {
                str_starts_with($mime, 'image/') => 'image',
                $mime === 'application/pdf' => 'pdf',
                default => 'other',
            },
            'mime_type' => $attachment['mime_type'],
            'size_bytes' => $attachment['size_bytes'],
            'source' => $attachment['source'],
            'link' => $file['web_view_link'] ?? null,
            'preview_url' => $file['preview_url'] ?? null,
            'created_at' => $attachment['created_at'],
            'uploaded_by' => $attachment['uploaded_by'],
            'can_remove' => $attachment['can_remove'] ?? false,
        ];
    }

    /**
     * The read-only banner of the screen: archived workspace, management
     * "lihat saja" or a task assigned by someone else ("titipan").
     *
     * @param  array{can: array<string, bool>, locked_reason: array<string, string|null>}  $abilities
     * @return array{kind: string, message: string, assigned_by?: array{id: string, name: string, avatar: string|null}}|null
     */
    private function banner(Task $task, User $viewer, array $abilities): ?array
    {
        $workspace = $task->workspace;

        if ($workspace->isArchived()) {
            return ['kind' => 'arsip', 'message' => 'Workspace diarsipkan: tugas ini hanya bisa dibaca.'];
        }

        if ($this->workspaces->isViewOnly($viewer, $workspace)) {
            return ['kind' => 'lihat_saja', 'message' => TaskPolicy::VIEW_ONLY];
        }

        if (! $abilities['can']['edit'] && $abilities['can']['work'] && $abilities['locked_reason']['edit'] === TaskPolicy::ASSIGNED_BY_OTHER) {
            $creator = $task->creator;
            $name = $creator->name ?? 'pembuatnya';

            return [
                'kind' => 'titipan',
                'message' => "Tugas ini ditugaskan oleh {$name}. Hanya {$name} atau atasan Anda yang bisa mengubahnya; Anda tetap bisa memindahkan status, mencentang checklist, dan berkomentar.",
                ...($creator !== null ? ['assigned_by' => PersonResource::from($creator)] : []),
            ];
        }

        return null;
    }
}
