<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\MeetingActionItem;
use Illuminate\Validation\ValidationException;

/**
 * Removes a follow-up from draft minutes (a task made from it stays).
 */
final class RemoveActionItem
{
    public function __construct(
        private readonly ResolveNotificationsForSubject $resolve,
        private readonly RoomEvents $events,
    ) {}

    public function handle(MeetingActionItem $item): void
    {
        if ($item->minutes->isFinal()) {
            throw ValidationException::withMessages(['minutes' => 'Notulen sudah final. Buka kembali draf untuk mengubahnya.']);
        }

        $this->resolve->handle($item, NotificationType::ActionItemDue);
        $item->delete();
        $this->events->minutesChanged($item->minutes);
    }
}
