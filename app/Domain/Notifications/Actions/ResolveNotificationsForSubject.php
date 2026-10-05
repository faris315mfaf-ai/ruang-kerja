<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use Illuminate\Database\Eloquent\Model;

/**
 * Called by modules when the action behind a "Perlu tindakan" notification is
 * done (request decided, overdue task completed, revision submitted…). Removes
 * the item from "Perlu tindakan" for every recipient; read state is unchanged.
 *
 *     app(ResolveNotificationsForSubject::class)->handle($request, NotificationType::RequestSubmitted);
 */
final class ResolveNotificationsForSubject
{
    /**
     * @return int number of notifications resolved
     */
    public function handle(Model $subject, NotificationType ...$types): int
    {
        $key = $subject->getKey();

        $query = InboxNotification::query()
            ->where('subject_type', $subject->getMorphClass())
            ->where('subject_id', is_scalar($key) ? (string) $key : '')
            ->where('action_required', true)
            ->whereNull('resolved_at');

        if ($types !== []) {
            $query->ofType(...$types);
        }

        return $query->update(['resolved_at' => now(), 'updated_at' => now()]);
    }
}
