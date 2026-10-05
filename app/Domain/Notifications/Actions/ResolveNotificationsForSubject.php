<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Models\InboxNotification;
use Illuminate\Database\Eloquent\Model;

/**
 * Called by modules when the action behind a "Perlu tindakan" notification is
 * done (request decided, overdue task completed, revision submitted…). Removes
 * the item from "Perlu tindakan" for every recipient; read state is unchanged.
 * The channel-independent dispatch claims of those types are released too, so
 * a later cycle (task late again) may remind once more.
 *
 *     app(ResolveNotificationsForSubject::class)->handle($request, NotificationType::RequestSubmitted);
 */
final class ResolveNotificationsForSubject
{
    public function __construct(private readonly NotificationDispatchLog $dispatchLog) {}

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

        $subjectId = is_scalar($key) ? (string) $key : '';

        foreach ($types === [] ? [null] : $types as $type) {
            $this->dispatchLog->release($type, $subject->getMorphClass(), [$subjectId]);
        }

        return $query->update(['resolved_at' => now(), 'updated_at' => now()]);
    }
}
