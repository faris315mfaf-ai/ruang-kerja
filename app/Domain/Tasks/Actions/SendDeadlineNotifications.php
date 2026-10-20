<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Notifications\Services\NotificationHistory;
use App\Domain\Tasks\Notifications\TaskDueSoonNotification;
use App\Domain\Tasks\Notifications\TaskOverdueNotification;
use App\Domain\Tasks\Services\TaskAudience;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\InboxNotification;
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
 *   while no unresolved reminder exists for that task and assignee (resolved
 *   when the task closes or the due date moves — MoveTask / UpdateTask).
 *
 * Archived workspaces and tasks without assignees are skipped. Idempotent
 * whatever channels people enabled: besides the Inbox row, every reminder is
 * claimed in `notification_dispatch_logs` (type, task, recipient, due date), so
 * e-mail-only recipients are not reminded again every day.
 *
 * @phpstan-type Report array{due_soon: int, overdue: int}
 */
final class SendDeadlineNotifications
{
    public function __construct(
        private readonly NotificationHistory $history,
        private readonly TaskAudience $audience,
        private readonly NotificationDispatchLog $dispatchLog,
    ) {}

    /**
     * @return Report
     */
    public function handle(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $today = $now->setTimezone(CurrentCompany::timezone())->startOfDay();
        $report = ['due_soon' => 0, 'overdue' => 0];

        $this->tasks()->whereDate('tasks.due_date', $today->addDay()->toDateString())
            ->chunkById(200, function ($tasks) use ($now, &$report): void {
                foreach ($tasks as $task) {
                    foreach ($this->recipients($task) as $user) {
                        if (! $this->history->wasSent($user, NotificationType::TaskDueSoon, $task, since: $now->subHours(20))
                            && $this->dispatchLog->claim($user, NotificationType::TaskDueSoon, $task, (string) $task->due_date?->toDateString())) {
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

                    $daysLate = (int) CarbonImmutable::parse($due->toDateString(), $today->getTimezone())->diffInDays($today);

                    foreach ($this->recipients($task) as $user) {
                        // One open reminder at a time: a resolved one (due date moved, task
                        // reopened) allows a new reminder when the task is late again.
                        if (! $this->hasOpenOverdueReminder($user, $task)
                            && $this->dispatchLog->claim($user, NotificationType::TaskOverdue, $task, $due->toDateString())) {
                            $user->notify(new TaskOverdueNotification($task, $daysLate));
                            $report['overdue']++;
                        }
                    }
                }
            }, 'tasks.id', 'id');

        return $report;
    }

    private function hasOpenOverdueReminder(User $user, Task $task): bool
    {
        return InboxNotification::query()
            ->visibleTo($user)
            ->ofType(NotificationType::TaskOverdue)
            ->where('subject_type', $task->getMorphClass())
            ->where('subject_id', $task->id)
            ->whereNull('resolved_at')
            ->exists();
    }

    /**
     * @return Builder<Task>
     */
    private function tasks(): Builder
    {
        return Task::query()
            ->open()
            ->whereNotNull('tasks.due_date')
            // Scheduled per company (CompanySchedule): only the current company's workspaces.
            ->whereIn('tasks.workspace_id', Workspace::query()->notArchived()->when(CurrentCompany::id(), fn (Builder $query, string $company) => $query->where('company_id', $company))->select('id'))
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

        return array_values($this->audience->withTaskAccess($task, $ids)->all());
    }
}
