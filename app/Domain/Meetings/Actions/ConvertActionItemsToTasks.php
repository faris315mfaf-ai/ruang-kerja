<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tasks\Actions\CreateTask;
use App\Models\MeetingActionItem;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * "Jadikan tugas": each selected follow-up without a task becomes a task
 * (CreateTask: next KEY-n number, assignee, due date) in the meeting's
 * workspace — or, for a meeting without one, the workspace the user picks.
 * Needs WorkspacePolicy::editTasks there. Idempotent: items that already
 * have a task are skipped (row lock per item), so a double click creates
 * nothing twice.
 */
final class ConvertActionItemsToTasks
{
    public function __construct(
        private readonly MinutesStore $store,
        private readonly CreateTask $createTask,
        private readonly ResolveNotificationsForSubject $resolve,
    ) {}

    /**
     * @param  list<string>  $itemIds
     * @return list<Task> tasks created by this call
     */
    public function handle(Occurrence $occurrence, User $actor, array $itemIds, ?Workspace $chosen = null): array
    {
        $workspace = $occurrence->meeting->workspace ?? $chosen;

        if ($workspace === null) {
            throw ValidationException::withMessages(['workspace_id' => 'Pilih workspace untuk tugas tindak lanjut.']);
        }

        Gate::forUser($actor)->authorize('editTasks', $workspace);

        $minutes = $this->store->find($occurrence);

        if ($minutes === null) {
            return [];
        }

        /** @var list<array{0: MeetingActionItem, 1: Task}> $created */
        $created = DB::transaction(function () use ($minutes, $actor, $itemIds, $workspace): array {
            $items = MeetingActionItem::query()
                ->where('minutes_id', $minutes->id)
                ->whereIn('id', $itemIds)
                ->whereNull('task_id')
                ->orderBy('position')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $created = [];

            foreach ($items as $item) {
                if (trim($item->text) === '') {
                    continue;
                }

                $task = $this->createTask->handle($workspace, $actor, [
                    'title' => mb_substr(trim($item->text), 0, 255),
                    'due_date' => $item->due_date?->toDateString(),
                    'assignee_ids' => $item->assignee_id !== null ? [$item->assignee_id] : [],
                ]);
                $item->forceFill(['task_id' => $task->id])->save();
                $created[] = [$item, $task];
            }

            return $created;
        });

        foreach ($created as [$item]) {
            $this->resolve->handle($item, NotificationType::ActionItemDue);
        }

        return array_map(fn (array $pair): Task => $pair[1], $created);
    }
}
