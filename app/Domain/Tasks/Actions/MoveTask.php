<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Tasks\Services\TaskLifecycle;
use App\Domain\Tasks\Services\TaskPositioner;
use App\Events\Tasks\TaskMoved;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Moves a card to a column, between two neighbours (Kanban drag & drop, the
 * mobile "Pindahkan" menu and Shift+←/→). Syncs status_category, started_at,
 * completed_at and canceled_at, and logs `task.status_changed`.
 */
final class MoveTask
{
    public function __construct(
        private readonly TaskPositioner $positioner,
        private readonly RecordActivity $recordActivity,
        private readonly ResolveNotificationsForSubject $resolveNotifications,
    ) {}

    public function handle(Task $task, User $actor, TaskStatus $status, ?string $afterId = null, ?string $beforeId = null): Task
    {
        if ($status->workspace_id !== $task->workspace_id) {
            throw ValidationException::withMessages(['status_id' => 'Kolom tidak ada di workspace ini.']);
        }

        $moved = DB::transaction(function () use ($task, $actor, $status, $afterId, $beforeId): Task {
            $this->positioner->lockColumn($status);

            /** @var Task $task */
            $task = Task::query()->with(['workspace', 'status'])->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $from = $task->status;

            $task->position = $this->positioner->between($status, $task->id, $afterId, $beforeId);
            TaskLifecycle::apply($task, $status, now());
            $task->save();
            $task->setRelation('status', $status);

            if ($from->id !== $status->id) {
                $this->recordActivity->handle($task->workspace, $task, $actor, ActivityEvent::TaskStatusChanged, [
                    'key' => $task->displayKey(),
                    'title' => $task->title,
                    'from' => ['id' => $from->id, 'name' => $from->name, 'category' => $from->category->value],
                    'to' => ['id' => $status->id, 'name' => $status->name, 'category' => $status->category->value],
                ]);
            }

            // Closed: "melewati tenggat" no longer needs action.
            if ($task->isClosed()) {
                $this->resolveNotifications->handle($task, NotificationType::TaskOverdue);
            }

            return $task;
        });

        TaskMoved::dispatch($moved);

        return $moved;
    }
}
