<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Services\TaskDescription;
use App\Domain\Tasks\Services\TaskRelations;
use App\Events\Tasks\TaskUpdated;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Partial update of a task (only the given keys). A new status_id moves the
 * card to the top of that column through MoveTask. Writes activities for
 * rename, priority, due date and (un)assignment.
 */
final class UpdateTask
{
    public function __construct(
        private readonly TaskRelations $relations,
        private readonly RecordActivity $recordActivity,
        private readonly MoveTask $moveTask,
    ) {}

    /**
     * @param  array{title?: string, description_text?: string|null, priority?: TaskPriority|int, start_date?: string|null, due_date?: string|null, estimate_hours?: float|int|string|null, assignee_ids?: list<string>, label_ids?: list<string>, status_id?: string}  $changes
     */
    public function handle(Task $task, User $actor, array $changes): Task
    {
        if (isset($changes['status_id']) && $changes['status_id'] !== $task->status_id) {
            $status = TaskStatus::query()->where('workspace_id', $task->workspace_id)->findOrFail($changes['status_id']);
            $task = $this->moveTask->handle($task, $actor, $status);
        }

        $task = DB::transaction(function () use ($task, $actor, $changes): Task {
            $task->loadMissing('workspace');
            $workspace = $task->workspace;
            $now = now();
            $base = ['key' => $task->displayKey(), 'title' => $task->title];

            if (array_key_exists('title', $changes)) {
                $task->title = trim($changes['title']);
            }

            if (array_key_exists('description_text', $changes)) {
                $task->description = TaskDescription::documentFromText($changes['description_text']);
                $task->description_text = TaskDescription::normalizeText($changes['description_text']);
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

            if (array_key_exists('assignee_ids', $changes)) {
                [$added, $removed] = $this->relations->syncAssignees(
                    $task,
                    $this->relations->memberIds($workspace, $changes['assignee_ids']),
                    $actor,
                    $now,
                );

                if ($added !== []) {
                    $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskAssigned, [...$base, 'user_ids' => $added]);
                }

                if ($removed !== []) {
                    $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskUnassigned, [...$base, 'user_ids' => $removed]);
                }
            }

            if (array_key_exists('label_ids', $changes)) {
                $this->relations->syncLabels($task, $this->relations->labelIds($workspace, $changes['label_ids']));
            }

            $task->touch();

            return $task;
        });

        TaskUpdated::dispatch($task);

        return $task;
    }
}
