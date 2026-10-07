<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;

/**
 * The latest minutes of the same meeting/series written for an earlier
 * occurrence, with their follow-ups (and tasks) loaded, and the follow-ups
 * still open there — the "Lanjutkan notulen rapat lalu" source of the
 * pre-join screen. Two queries (minutes, follow-ups with their tasks).
 */
final class PreviousMinutes
{
    public const int OPEN_LIMIT = 20;

    public function for(Occurrence $occurrence): ?MeetingMinutes
    {
        return MeetingMinutes::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->where('occurrence_date', '<', $occurrence->date)
            ->orderByDesc('occurrence_date')
            ->with('actionItems.task.workspace:id,key')
            ->first();
    }

    /**
     * Follow-ups of those minutes that are not done (ticked off or task
     * done), most urgent first.
     *
     * @return list<MeetingActionItem>
     */
    public function openItems(?MeetingMinutes $minutes): array
    {
        if ($minutes === null) {
            return [];
        }

        return array_values($minutes->actionItems
            ->reject(fn (MeetingActionItem $item): bool => $item->isDone())
            ->sortBy(fn (MeetingActionItem $item): string => ($item->due_date?->toDateString() ?? '9999-12-31').sprintf('%05d', $item->position).$item->id)
            ->take(self::OPEN_LIMIT)
            ->values()
            ->all());
    }
}
