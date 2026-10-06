<?php

namespace App\Domain\Automation\Actions;

use App\Domain\Automation\Services\AutomationAccess;
use App\Domain\Tasks\Actions\CreateTask;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates the task of a recurring task through CreateTask (numbering,
 * activity, assignment notification), due on $date.
 *
 * - Scheduled (07.00 job): idempotent per (recurring task, date) — the
 *   occurrence row is claimed first (primary key), so a second run of the job
 *   or a concurrent worker creates nothing. Runs as the creator, or the
 *   workspace owner when the creator can no longer create tasks there.
 * - "Buat sekarang": an extra task for $actor, not tied to the schedule.
 */
final class CreateTaskFromRecurring
{
    public function __construct(
        private readonly CreateTask $createTask,
        private readonly AutomationAccess $access,
    ) {}

    /**
     * @return Task|null null when the scheduled date was already handled or nobody may create the task
     */
    public function handle(RecurringTask $recurring, string $date, ?User $actor = null): ?Task
    {
        $recurring->loadMissing('workspace');
        $scheduled = $actor === null;
        $actor ??= $this->scheduledActor($recurring);

        if ($actor === null || $recurring->workspace->isArchived()) {
            return null;
        }

        return DB::transaction(function () use ($recurring, $date, $actor, $scheduled): ?Task {
            if ($scheduled) {
                $claimed = DB::table('recurring_task_occurrences')->insertOrIgnore([
                    'recurring_task_id' => $recurring->id,
                    'occurs_on' => $date,
                    'created_at' => now(),
                ]);

                if ($claimed === 0) {
                    return null;
                }
            }

            $task = $this->createTask->handle($recurring->workspace, $actor, [
                'title' => $recurring->title,
                'priority' => $recurring->priority,
                'due_date' => $date,
                'assignee_ids' => $recurring->assignee_id !== null ? [$recurring->assignee_id] : [],
            ]);

            if ($scheduled) {
                DB::table('recurring_task_occurrences')
                    ->where('recurring_task_id', $recurring->id)
                    ->where('occurs_on', $date)
                    ->update(['task_id' => $task->id]);
            }

            RecurringTask::query()->whereKey($recurring->id)->update([
                'created_count' => DB::raw('created_count + 1'),
                'last_created_on' => $date,
                'updated_at' => now(),
            ]);

            return $task;
        });
    }

    private function scheduledActor(RecurringTask $recurring): ?User
    {
        $workspace = $recurring->workspace;
        $ids = array_values(array_filter([$recurring->created_by, $workspace->owner_id]));
        $users = User::query()->whereIn('id', $ids)->get()->keyBy('id');

        foreach ($ids as $id) {
            $user = $users->get($id);

            if ($user instanceof User && $this->access->canEditTasks($user, $workspace)) {
                return $user;
            }
        }

        return null;
    }
}
