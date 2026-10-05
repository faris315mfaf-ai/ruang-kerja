<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * De-duplication helper for scheduled jobs (e.g. "tenggat H-1" must be sent
 * once per task per assignee):
 *
 *     if (! $history->wasSent($user, NotificationType::TaskDueSoon, $task)) { $user->notify(...); }
 *
 * Only in-app records are visible here, so a user who switched the in-app
 * channel off for that event may receive the email again on the next run;
 * pass $since to bound the window.
 */
final class NotificationHistory
{
    public function wasSent(User $user, NotificationType $type, Model $subject, ?CarbonInterface $since = null): bool
    {
        $key = $subject->getKey();

        return InboxNotification::query()
            ->visibleTo($user)
            ->ofType($type)
            ->where('subject_type', $subject->getMorphClass())
            ->where('subject_id', is_scalar($key) ? (string) $key : '')
            ->when($since, fn ($query) => $query->where('created_at', '>=', $since))
            ->exists();
    }
}
