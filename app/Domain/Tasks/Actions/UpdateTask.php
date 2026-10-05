<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Services\TaskDescription;
use App\Domain\Tasks\Services\TaskRelations;
use App\Domain\Tasks\Services\TaskRichText;
use App\Events\Tasks\TaskAssigneesAdded;
use App\Events\Tasks\TaskUpdated;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Partial update of a task (only the given keys). A new status_id moves the
 * card to the top of that column through MoveTask. Writes activities for
 * rename, priority, start/due date, estimate, description and
 * (un)assignment; rebuilds description mentions (notifying people with
 * access) and notifies new assignees (TaskAssigneesAdded).
 */
final class UpdateTask
{
    public function __construct(
        private readonly TaskRelations $relations,
        private readonly RecordActivity $recordActivity,
        private readonly MoveTask $moveTask,
        private readonly TaskRichText $richText,
        private readonly SyncMentions $syncMentions,
        private readonly ResolveNotificationsForSubject $resolveNotifications,
        private readonly ResolveOverdueNotices $overdueNotices,
    ) {}

    /**
     * `description` (Tiptap JSON) wins over `description_text` (plain text).
     *
     * @param  array{title?: string, description?: array<mixed>|null, description_text?: string|null, priority?: TaskPriority|int, start_date?: string|null, due_date?: string|null, estimate_hours?: float|int|string|null, assignee_ids?: list<string>, label_ids?: list<string>, status_id?: string}  $changes
     */
    public function handle(Task $task, User $actor, array $changes): Task
    {
        $addedAssignees = [];
        $mentionIds = null;

        // One transaction for the move and the field changes: a failure in either
        // leaves the task untouched (MoveTask's own transaction becomes a savepoint).
        $task = DB::transaction(function () use ($task, $actor, $changes, &$addedAssignees, &$mentionIds): Task {
            if (isset($changes['status_id']) && $changes['status_id'] !== $task->status_id) {
                $status = TaskStatus::query()->where('workspace_id', $task->workspace_id)->findOrFail($changes['status_id']);
                $task = $this->moveTask->handle($task, $actor, $status);
            }

            $task->loadMissing('workspace');
            $workspace = $task->workspace;
            $now = now();
            $base = ['key' => $task->displayKey(), 'title' => $task->title];

            if (array_key_exists('title', $changes)) {
                $task->title = trim($changes['title']);
            }

            if (array_key_exists('description', $changes)) {
                $prepared = $this->richText->prepare($workspace, $actor, $changes['description']);
                $task->description = $prepared['document'];
                $task->description_text = $prepared['text'];
                $mentionIds = $prepared['mentioned_ids'];
            } elseif (array_key_exists('description_text', $changes)) {
                $task->description = TaskDescription::documentFromText($changes['description_text']);
                $task->description_text = TaskDescription::normalizeText($changes['description_text']);
                $mentionIds = [];
            }

            if (array_key_exists('priority', $changes)) {
                $priority = $changes['priority'];
                $task->priority = $priority instanceof TaskPriority ? $priority : TaskPriority::from($priority);
            }

            foreach (['start_date', 'due_date', 'estimate_hours'] as $field) {
                if (array_key_exists($field, $changes)) {
                    $task->setAttribute($field, $changes[$field]);
                }
            }

            $original = [
                'title' => $task->getOriginal('title'),
                'priority' => $task->getOriginal('priority'),
                'due_date' => $task->getOriginal('due_date'),
                'start_date' => $task->getOriginal('start_date'),
                'estimate_hours' => $task->getOriginal('estimate_hours'),
            ];
            $dirty = $task->getDirty();
            $task->save();

            if (array_key_exists('title', $dirty)) {
                $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskRenamed, [
                    ...$base,
                    'from' => $original['title'],
                    'to' => $task->title,
                ]);
            }

            if (array_key_exists('priority', $dirty)) {
                $from = $original['priority'];
                $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskPriorityChanged, [
                    ...$base,
                    'from' => $from instanceof TaskPriority ? $from->value : null,
                    'to' => $task->priority->value,
                ]);
            }

            if (array_key_exists('due_date', $dirty)) {
                $from = $original['due_date'];
                $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskDueDateChanged, [
                    ...$base,
                    'from' => $from instanceof \DateTimeInterface ? $from->format('Y-m-d') : null,
                    'to' => $task->due_date?->toDateString(),
                ]);
            }

            if (array_key_exists('start_date', $dirty)) {
                $from = $original['start_date'];
                $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskStartDateChanged, [
                    ...$base,
                    'from' => $from instanceof \DateTimeInterface ? $from->format('Y-m-d') : null,
                    'to' => $task->start_date?->toDateString(),
                ]);
            }

            if (array_key_exists('estimate_hours', $dirty)) {
                $from = $original['estimate_hours'];
                $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskEstimateChanged, [
                    ...$base,
                    'from' => $from === null ? null : (float) $from,
                    'to' => $task->estimate_hours === null ? null : (float) $task->estimate_hours,
                ]);
            }

            if (array_key_exists('description', $dirty)) {
                $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskDescriptionChanged, $base);
            }

            if ($mentionIds !== null) {
                $this->syncMentions->handle($task, $task, $actor, $mentionIds);
            }

            // Due date moved to today or later: the overdue reminder is settled.
            if (array_key_exists('due_date', $dirty) && ($task->due_date === null || $task->due_date->toDateString() >= now(config()->string('app.office_timezone'))->toDateString())) {
                $this->resolveNotifications->handle($task, NotificationType::TaskOverdue);
            }

            if (array_key_exists('assignee_ids', $changes)) {
                [$added, $removed] = $this->relations->syncAssignees(
                    $task,
                    $this->relations->memberIds($workspace, $changes['assignee_ids']),
                    $actor,
                    $now,
                );

                $addedAssignees = $added;

                if ($added !== []) {
                    $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskAssigned, [...$base, 'user_ids' => $added]);
                }

                if ($removed !== []) {
                    $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskUnassigned, [...$base, 'user_ids' => $removed]);
                    // No longer their task: their overdue reminder is settled.
                    $this->overdueNotices->handle($task, $removed);
                }
            }

            if (array_key_exists('label_ids', $changes)) {
                $this->relations->syncLabels($task, $this->relations->labelIds($workspace, $changes['label_ids']));
            }

            $task->touch();

            return $task;
        });

        TaskUpdated::dispatch($task);

        if ($addedAssignees !== []) {
            TaskAssigneesAdded::dispatch($task, $actor, $addedAssignees);
        }

        return $task;
    }
}
