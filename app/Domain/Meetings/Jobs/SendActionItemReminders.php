<?php

namespace App\Domain\Meetings\Jobs;

use App\Domain\Meetings\Notifications\ActionItemDueNotification;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily (office time): reminds assignees of open follow-ups — due tomorrow
 * (H-1) and past due — that were not ticked off and did not become a task
 * (tasks have their own deadline reminders). Once per follow-up, kind and
 * due date (notification_dispatch_logs); canceled or deleted meetings and
 * people who lost access are skipped.
 *
 * @phpstan-type Report array{soon: int, overdue: int}
 */
final class SendActionItemReminders implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $uniqueFor = 600;

    /**
     * @return Report
     */
    public function handle(NotificationDispatchLog $dispatchLog, MeetingPolicy $policy): array
    {
        $today = CarbonImmutable::now()->setTimezone(config()->string('app.office_timezone'))->toDateString();
        $tomorrow = CarbonImmutable::parse($today)->addDay()->toDateString();
        $report = ['soon' => 0, 'overdue' => 0];

        MeetingActionItem::query()
            ->whereNull('done_at')
            ->whereNull('task_id')
            ->whereNotNull('assignee_id')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', $tomorrow)
            ->whereHas('minutes.meeting', fn (Builder $meeting) => $meeting->whereNull('canceled_at'))
            ->with(['assignee', 'minutes.meeting'])
            ->chunkById(200, function ($items) use ($dispatchLog, $policy, $today, $tomorrow, &$report): void {
                foreach ($items as $item) {
                    $assignee = $item->assignee;
                    /** @var Meeting $meeting */
                    $meeting = $item->minutes->meeting;
                    $due = $item->due_date?->toDateString();

                    if ($assignee === null || $due === null || ! $assignee->isActive() || ! $policy->canView($assignee, $meeting)) {
                        continue;
                    }

                    $kind = $due === $tomorrow ? 'soon' : ($due < $today ? 'overdue' : null);

                    if ($kind !== null && $dispatchLog->claim($assignee, NotificationType::ActionItemDue, $item, $kind.':'.$due)) {
                        $assignee->notify(new ActionItemDueNotification($item, $kind));
                        $report[$kind]++;
                    }
                }
            });

        return $report;
    }
}
