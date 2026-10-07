<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\MeetingActionItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Changes a follow-up: text, assignee and due date (draft minutes only) and
 * `done` (also on final minutes — the checklist). Ticking it off settles its
 * reminders in the Inbox.
 */
final class UpdateActionItem
{
    public function __construct(
        private readonly ResolveNotificationsForSubject $resolve,
        private readonly RoomEvents $events,
    ) {}

    /**
     * @param  array{text?: string|null, assignee_id?: string|null, due_date?: string|null, done?: bool}  $input
     */
    public function handle(MeetingActionItem $item, User $actor, array $input): MeetingActionItem
    {
        $item = DB::transaction(function () use ($item, $actor, $input): MeetingActionItem {
            $item = MeetingActionItem::query()->with('minutes')->lockForUpdate()->findOrFail($item->id);
            $fields = array_intersect_key($input, array_flip(['text', 'assignee_id', 'due_date']));

            if ($fields !== []) {
                if ($item->minutes->isFinal()) {
                    throw ValidationException::withMessages(['minutes' => 'Notulen sudah final. Buka kembali draf untuk mengubahnya.']);
                }

                if (array_key_exists('text', $fields)) {
                    $fields['text'] = trim((string) $fields['text']);
                }

                $item->fill($fields);
                $item->minutes->forceFill(['updated_by' => $actor->id])->save();
            }

            if (array_key_exists('done', $input)) {
                $item->done_at = $input['done'] ? ($item->done_at ?? now()) : null;
            }

            $item->save();
            $this->events->minutesChanged($item->minutes);

            return $item;
        });

        if ($item->done_at !== null || $item->wasChanged(['assignee_id', 'due_date'])) {
            $this->resolve->handle($item, NotificationType::ActionItemDue);
        }

        return $item;
    }
}
