<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationHistory;
use App\Domain\Tasks\Notifications\TaskDueSoonNotification;
use App\Domain\Tasks\Notifications\TaskOverdueNotification;
use App\Domain\Tasks\Services\TaskAudience;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Deadline reminders for assignees of open tasks (scheduled daily, see
 * routes/console.php → tasks:notify-deadlines):
 *
 * - H-1: due tomorrow (office date) → TaskDueSoonNotification, once per day;
 * - overdue: due before today → TaskOverdueNotification ("Perlu tindakan"),
 *   once per task, assignee and due date (resolved when the task closes or
 *   the due date moves — MoveTask / UpdateTask).
 *
 * Archived workspaces and tasks without assignees are skipped. Idempotent.
 *
 * @phpstan-type Report array{due_soon: int, overdue: int}
 */
final class SendDeadlineNotifications
{
    public function __construct(
        private readonly NotificationHistory $history,
        private readonly TaskAudience $audience,
    ) {}

    /**
     * @return Report
     */
    public function handle(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $today = $now->setTimezone(config()->string('app.office_timezone'))->startOfDay();
        $report = ['due_soon' => 0, 'overdue' => 0];

        $this->tasks()->whereDate('tasks.due_date', $today->addDay()->toDateString())
            ->chunkById(200, function ($tasks) use ($now, &$report): void {
                foreach ($tasks as $task) {
                    foreach ($this->recipients($task) as $user) {
                        if (! $this->history->wasSent($user, NotificationType::TaskDueSoon, $task, since: $now->subHours(20))) {
                            $user->notify(new TaskDueSoonNotification($task));
                            $report['due_soon']++;
                        }
                    }
                }
            }, 'tasks.id', 'id');

        $this->tasks()->whereDate('tasks.due_date', '<', $today->toDateString())
            ->chunkById(200, function ($tasks) use ($today, &$report): void {
                foreach ($tasks as $task) {
                    $due = $task->due_date;

                    if ($due === null) {
                        continue;
                    }

                    // One reminder per due date: after it passed (office time).
                    $since = CarbonImmutable::parse($due->toDateString(), $today->getTimezone())->addDay();
                    $daysLate = (int) $since->diffInDays($today) + 1;

                    foreach ($this->recipients($task) as $user) {
                        if (! $this->history->wasSent($user, NotificationType::TaskOverdue, $task, since: $since)) {
                            $user->notify(new TaskOverdueNotification($task, $daysLate));
                            $report['overdue']++;
                        }
                    }
                }
            }, 'tasks.id', 'id');

        return $report;
    }

    /**
     * @return Builder<Task>
     */
    private function tasks(): Builder
    {
        return Task::query()
            ->open()
            ->whereNotNull('tasks.due_date')
            ->whereIn('tasks.workspace_id', Workspace::query()->notArchived()->select('id'))
            ->whereHas('assignees')
            ->with(['workspace', 'assignees'])
            ->select('tasks.*');
    }

    /**
     * Active assignees who can still see the workspace.
     *
     * @return list<User>
     */
    private function recipients(Task $task): array
    {
        /** @var list<string> $ids */
        $ids = $task->assignees->pluck('id')->all();

        return array_values($this->audience->withAccess($task->workspace, $ids)->all());
    }
}
