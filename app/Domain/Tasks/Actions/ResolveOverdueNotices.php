<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Models\InboxNotification;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;

/**
 * Settles "melewati tenggat" ("Perlu tindakan") reminders that no longer need
 * action: the task was deleted, its workspace archived, or the recipient was
 * unassigned / lost access to the workspace.
 *
 * Scope = one task, or every task of a workspace (deleted ones included);
 * optionally only for the given recipients. Read state is unchanged.
 */
final class ResolveOverdueNotices
{
    public function __construct(private readonly NotificationDispatchLog $dispatchLog) {}

    /**
     * @param  list<string>|null  $recipientIds  null = every recipient
     * @return int number of notifications resolved
     */
    public function handle(Task|Workspace $scope, ?array $recipientIds = null): int
    {
        if ($recipientIds === []) {
            return 0;
        }

        $taskMorph = (new Task)->getMorphClass();

        $query = InboxNotification::query()
            ->ofType(NotificationType::TaskOverdue)
            ->where('subject_type', $taskMorph)
            ->where('action_required', true)
            ->whereNull('resolved_at');

        $subjectIds = $scope instanceof Task
            ? [$scope->id]
            : Task::query()->withTrashed()->where('workspace_id', $scope->id)->select('id')->toBase();

        $query->whereIn('subject_id', $subjectIds);
        $this->dispatchLog->release(NotificationType::TaskOverdue, $taskMorph, $subjectIds, $recipientIds);

        if ($recipientIds !== null) {
            $query->where('notifiable_type', (new User)->getMorphClass())
                ->whereIn('notifiable_id', $recipientIds);
        }

        return $query->update(['resolved_at' => now(), 'updated_at' => now()]);
    }
}
