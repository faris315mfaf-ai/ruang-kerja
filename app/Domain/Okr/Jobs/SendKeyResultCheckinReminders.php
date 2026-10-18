<?php

namespace App\Domain\Okr\Jobs;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Okr\Notifications\KeyResultCheckinReminderNotification;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\KeyResult;
use App\Models\Objective;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Gate;

/**
 * Friday 15.00 (office time): reminds every owner of a key result of an
 * active objective of the current quarter that has no check-in since Monday
 * of this week. One notification per owner per week listing their pending
 * key results, at most once even when the job runs twice
 * (NotificationDispatchLog, cycle = Monday's date).
 */
final class SendKeyResultCheckinReminders implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $uniqueFor = 600;

    public function handle(NotificationDispatchLog $log): int
    {
        $today = OfficeTime::today();
        $weekStart = $today->startOfWeek(CarbonImmutable::MONDAY)->toDateString();
        $quarter = Quarter::of($today)->key();
        $sent = 0;

        $pending = KeyResult::query()
            ->whereIn('objective_id', Objective::query()
                ->where('status', ObjectiveStatus::Active->value)
                ->where('quarter', $quarter)
                ->select('id'))
            ->whereIn('owner_id', User::query()->active()->select('id'))
            ->whereDoesntHave('checkins', fn ($checkins) => $checkins->where('checked_on', '>=', $weekStart))
            ->with(['objective', 'owner'])
            ->orderBy('id')
            ->get()
            ->groupBy('owner_id');

        foreach ($pending as $keyResults) {
            /** @var KeyResult $first */
            $first = $keyResults->first();
            $owner = $first->owner;
            $ids = array_values($keyResults
                ->filter(fn (KeyResult $kr): bool => Gate::forUser($owner)->allows('checkin', $kr))
                ->map(fn (KeyResult $kr): string => $kr->id)
                ->all());

            if ($ids === [] || ! $log->claim($owner, NotificationType::OkrCheckinReminder, $owner, $weekStart)) {
                continue;
            }

            $owner->notify(new KeyResultCheckinReminderNotification($owner, $ids));
            $sent++;
        }

        return $sent;
    }
}
