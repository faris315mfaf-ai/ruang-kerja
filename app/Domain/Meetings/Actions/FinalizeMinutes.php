<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MinutesStatus;
use App\Domain\Meetings\Notifications\MinutesFinalizedNotification;
use App\Domain\Meetings\Services\MinutesCollab;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Finalkan & bagikan": locks the minutes (always a version snapshot), writes
 * `meeting.minutes_finalized` to audit_logs and tells the internal
 * participants. Blocked while something is missing (each problem names the
 * fix, same rules as minutesProblems() in features/meetings/lib.ts).
 */
final class FinalizeMinutes
{
    public function __construct(
        private readonly MinutesStore $store,
        private readonly SaveMinutes $save,
        private readonly AuditLogger $audit,
        private readonly RoomEvents $events,
        private readonly MinutesCollab $collab,
    ) {}

    public function handle(Occurrence $occurrence, User $actor): MeetingMinutes
    {
        $finalized = false;

        $minutes = DB::transaction(function () use ($occurrence, $actor, &$finalized): MeetingMinutes {
            $minutes = $this->store->open($occurrence);

            if ($minutes->isFinal()) {
                return $minutes;
            }

            $items = MeetingActionItem::query()->where('minutes_id', $minutes->id)->orderBy('position')->orderBy('id')->get();
            $problems = self::problems($minutes, array_values($items->all()));

            if ($problems !== []) {
                throw ValidationException::withMessages(['minutes' => $problems]);
            }

            $minutes->forceFill([
                'status' => MinutesStatus::Final,
                'finalized_at' => now(),
                'finalized_by' => $actor->id,
                'updated_by' => $actor->id,
            ])->save();
            $this->save->snapshot($minutes, $actor, force: true);

            $this->audit->log('meeting.minutes_finalized', $minutes, ['status' => MinutesStatus::Draft->value], [
                'status' => MinutesStatus::Final->value,
                'meeting_id' => $occurrence->meeting->id,
                'occurrence_date' => $occurrence->date,
            ], $actor);

            $minutes->setRelation('actionItems', $items);
            $finalized = true;

            return $minutes;
        });

        if ($finalized) {
            $this->events->minutesChanged($minutes, $occurrence->meeting);
            $this->collab->reconnect($minutes);
            $this->notifyParticipants($occurrence, $minutes, $actor);
        }

        return $minutes;
    }

    /**
     * @param  list<MeetingActionItem>  $items
     * @return list<string>
     */
    public static function problems(MeetingMinutes $minutes, array $items): array
    {
        $problems = [];

        if (! collect($minutes->attendance)->contains(fn (array $mark): bool => (bool) $mark['present'])) {
            $problems[] = 'Tandai minimal satu peserta yang hadir.';
        }

        foreach ($items as $index => $item) {
            $label = 'Tindak lanjut '.($index + 1);

            if (trim($item->text) === '') {
                $problems[] = "{$label} belum diisi.";
            }

            if ($item->assignee_id === null) {
                $problems[] = "{$label} belum punya penanggung jawab.";
            }

            if ($item->due_date === null) {
                $problems[] = "{$label} belum punya tenggat.";
            }
        }

        return $problems;
    }

    private function notifyParticipants(Occurrence $occurrence, MeetingMinutes $minutes, User $actor): void
    {
        $meeting = $occurrence->meeting;
        $meeting->loadMissing('participants.user');
        $items = $minutes->relationLoaded('actionItems') ? $minutes->actionItems->count() : 0;

        foreach ($meeting->participants as $participant) {
            $user = $participant->user;

            if ($user !== null && $user->id !== $actor->id && $user->isActive()) {
                $user->notify(new MinutesFinalizedNotification($meeting, $occurrence->date, $actor, count($minutes->decisions), $items));
            }
        }
    }
}
