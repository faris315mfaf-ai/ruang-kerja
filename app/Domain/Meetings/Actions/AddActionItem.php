<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\RoomEvents;
use App\Models\MeetingActionItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Adds a follow-up at the end of the draft minutes (created on first use).
 */
final class AddActionItem
{
    public function __construct(
        private readonly MinutesStore $store,
        private readonly RoomEvents $events,
    ) {}

    /**
     * @param  array{text?: string|null, assignee_id?: string|null, due_date?: string|null}  $input
     */
    public function handle(Occurrence $occurrence, User $actor, array $input): MeetingActionItem
    {
        return DB::transaction(function () use ($occurrence, $actor, $input): MeetingActionItem {
            $minutes = $this->store->open($occurrence);

            if ($minutes->isFinal()) {
                throw ValidationException::withMessages(['minutes' => 'Notulen sudah final. Buka kembali draf untuk mengubahnya.']);
            }

            $position = (int) MeetingActionItem::query()->where('minutes_id', $minutes->id)->max('position') + 1;
            $minutes->forceFill(['updated_by' => $actor->id])->save();
            $this->events->minutesChanged($minutes, $occurrence->meeting);

            return MeetingActionItem::query()->create([
                'minutes_id' => $minutes->id,
                'position' => $position,
                'text' => trim((string) ($input['text'] ?? '')),
                'assignee_id' => $input['assignee_id'] ?? null,
                'due_date' => $input['due_date'] ?? null,
            ]);
        });
    }
}
