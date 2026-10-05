<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\TaskDescription;
use App\Domain\Tasks\Services\TaskLifecycle;
use App\Domain\Tasks\Services\TaskPositioner;
use App\Domain\Tasks\Services\TaskRelations;
use App\Events\Tasks\TaskCreated;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Creates a task at the top of its column with the next KEY-n number.
 *
 * Numbering: `UPDATE workspaces SET task_sequence = task_sequence + 1 …
 * RETURNING` inside the transaction — the row lock serializes concurrent
 * creators of the same workspace until commit, so numbers are unique and
 * gap-free for committed tasks (docs/ARCHITECTURE.md §3.5).
 */
final class CreateTask
{
    public function __construct(
        private readonly TaskPositioner $positioner,
        private readonly TaskRelations $relations,
        private readonly RecordActivity $recordActivity,
    ) {}

    /**
     * @param  array{title: string, status_id?: string|null, priority?: TaskPriority|int|null, start_date?: string|null, due_date?: string|null, estimate_hours?: float|int|string|null, description_text?: string|null, assignee_ids?: list<string>, label_ids?: list<string>, parent_id?: string|null}  $input
     */
    public function handle(Workspace $workspace, User $actor, array $input): Task
    {
        $task = DB::transaction(function () use ($workspace, $actor, $input): Task {
            $number = $this->nextNumber($workspace);
            $status = $this->resolveStatus($workspace, $input['status_id'] ?? null);
            $now = now();

            $this->positioner->lockColumn($status);

            $priority = $input['priority'] ?? TaskPriority::None;
            $parentId = $input['parent_id'] ?? null;

            $task = new Task([
                'workspace_id' => $workspace->id,
                'number' => $number,
                'parent_id' => $parentId !== null && Task::query()->where('workspace_id', $workspace->id)->whereKey($parentId)->exists() ? $parentId : null,
                'title' => trim($input['title']),
                'description' => TaskDescription::documentFromText($input['description_text'] ?? null),
                'description_text' => TaskDescription::normalizeText($input['description_text'] ?? null),
                'priority' => $priority instanceof TaskPriority ? $priority : TaskPriority::from($priority),
                'position' => $this->positioner->top($status),
                'start_date' => $input['start_date'] ?? null,
                'due_date' => $input['due_date'] ?? null,
                'estimate_hours' => $input['estimate_hours'] ?? null,
                'created_by' => $actor->id,
            ]);

            TaskLifecycle::apply($task, $status, $now);
            $task->save();
            $task->setRelation('workspace', $workspace);

            $assignees = $this->relations->memberIds($workspace, $input['assignee_ids'] ?? []);
            $this->relations->syncAssignees($task, $assignees, $actor, $now);
            $this->relations->syncLabels($task, $this->relations->labelIds($workspace, $input['label_ids'] ?? []));
            $this->relations->watch($task, [$actor->id], $now);

            $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskCreated, [
                'key' => $task->displayKey(),
                'title' => $task->title,
                'status' => $status->name,
            ]);

            if ($assignees !== []) {
                $this->recordActivity->handle($workspace, $task, $actor, ActivityEvent::TaskAssigned, [
                    'key' => $task->displayKey(),
                    'title' => $task->title,
                    'user_ids' => $assignees,
                ]);
            }

            return $task;
        });

        TaskCreated::dispatch($task);

        return $task;
    }

    private function nextNumber(Workspace $workspace): int
    {
        $row = DB::selectOne(
            'UPDATE workspaces SET task_sequence = task_sequence + 1 WHERE id = ? RETURNING task_sequence',
            [$workspace->id],
        );

        if (! is_object($row) || ! isset($row->task_sequence)) {
            throw new RuntimeException("Workspace [{$workspace->id}] not found.");
        }

        $workspace->task_sequence = (int) $row->task_sequence;
        $workspace->syncOriginalAttribute('task_sequence');

        return $workspace->task_sequence;
    }

    /**
     * The requested column, else the first `todo` column, else the first column.
     */
    private function resolveStatus(Workspace $workspace, ?string $statusId): TaskStatus
    {
        $statuses = TaskStatus::query()->where('workspace_id', $workspace->id)->orderBy('position')->get();

        $status = ($statusId !== null ? $statuses->firstWhere('id', $statusId) : null)
            ?? $statuses->first(fn (TaskStatus $status): bool => $status->category === TaskStatusCategory::Todo)
            ?? $statuses->first();

        if ($status === null) {
            throw new RuntimeException("Workspace [{$workspace->id}] has no columns.");
        }

        return $status;
    }
}
