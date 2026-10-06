<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Notifications\ActionItemDueNotification;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Models\MeetingActionItem;
use App\Models\User;
use App\Policies\MeetingPolicy;

/**
 * "Ingatkan PIC": reminds the assignee of every open follow-up (not ticked
 * off, not turned into a task). At most once per follow-up per office day,
 * whatever channels the assignee uses (notification_dispatch_logs).
 */
final class RemindActionItemOwners
{
    public function __construct(
        private readonly MinutesStore $store,
        private readonly NotificationDispatchLog $dispatchLog,
        private readonly MeetingPolicy $policy,
    ) {}

    /**
     * @return list<string> ids of the people reminded now
     */
    public function handle(Occurrence $occurrence, User $actor): array
    {
        $minutes = $this->store->find($occurrence);

        if ($minutes === null) {
            return [];
        }

        $today = now()->setTimezone(config()->string('app.office_timezone'))->toDateString();
        $reminded = [];

        MeetingActionItem::query()
            ->where('minutes_id', $minutes->id)
            ->whereNull('done_at')
            ->whereNull('task_id')
            ->whereNotNull('assignee_id')
            ->with(['assignee', 'minutes.meeting'])
            ->orderBy('position')
            ->get()
            ->each(function (MeetingActionItem $item) use ($occurrence, $actor, $today, &$reminded): void {
                $assignee = $item->assignee;

                if ($assignee === null || ! $assignee->isActive() || ! $this->policy->canView($assignee, $occurrence->meeting)) {
                    return;
                }

                if ($this->dispatchLog->claim($assignee, NotificationType::ActionItemDue, $item, 'remind:'.$today)) {
                    $assignee->notify(new ActionItemDueNotification($item, 'reminder', $actor));
                    $reminded[$assignee->id] = true;
                }
            });

        return array_keys($reminded);
    }
}
