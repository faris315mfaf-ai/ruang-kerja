<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Shared loader of the meeting pages: series overlapping a range → their
 * occurrences, the minutes written for them (one query) and the people they
 * mention — a fixed number of queries whatever the data (PageQueryCountTest).
 */
final class MeetingFeed
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly MeetingPresenter $presenter,
    ) {}

    /**
     * @param  Builder<Meeting>  $meetings
     * @return Collection<int, Occurrence>
     */
    public function occurrences(Builder $meetings, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        $series = $meetings->overlapping($from, $to)
            ->with(['participants', 'workspace:id,key,name'])
            ->select('meetings.*')
            ->get();

        return $this->occurrences->between($series, $from, $to);
    }

    /**
     * Minutes of the occurrences, keyed by Occurrence::key().
     *
     * @param  Collection<int, Occurrence>  $occurrences
     * @return array<string, MeetingMinutes>
     */
    public function minutesFor(Collection $occurrences): array
    {
        if ($occurrences->isEmpty()) {
            return [];
        }

        $dates = $occurrences->map(fn (Occurrence $occurrence): string => $occurrence->date)->unique()->values()->all();
        $keys = $occurrences->map(fn (Occurrence $occurrence): string => $occurrence->key())->flip()->all();

        $result = [];

        MeetingMinutes::query()
            ->whereIn('meeting_id', $occurrences->map(fn (Occurrence $occurrence): string => $occurrence->meeting->id)->unique()->values()->all())
            ->whereIn('occurrence_date', $dates)
            ->with(['actionItems.task.workspace:id,key'])
            ->get()
            ->each(function (MeetingMinutes $minutes) use ($keys, &$result): void {
                $key = $minutes->meeting_id.':'.$minutes->occurrence_date->toDateString();

                if (isset($keys[$key])) {
                    $result[$key] = $minutes;
                }
            });

        return $result;
    }

    /**
     * @param  Collection<int, Occurrence>  $occurrences
     * @param  array<string, MeetingMinutes>  $minutes
     * @return list<array<string, mixed>>
     */
    public function present(Collection $occurrences, array $minutes): array
    {
        return array_values($occurrences
            ->map(fn (Occurrence $occurrence): array => $this->presenter->meeting($occurrence, $minutes[$occurrence->key()] ?? null))
            ->all());
    }

    /**
     * Everyone the occurrences and minutes refer to, plus extra ids.
     *
     * @param  iterable<Occurrence>  $occurrences
     * @param  iterable<MeetingMinutes>  $minutes
     * @param  list<string|null>  $extra
     * @return list<array<string, mixed>>
     */
    public function people(iterable $occurrences, iterable $minutes = [], array $extra = []): array
    {
        $ids = $extra;

        foreach ($occurrences as $occurrence) {
            $meeting = $occurrence->meeting;
            $ids[] = $meeting->organizer_id;
            $ids[] = $meeting->minute_taker_id;

            foreach ($meeting->participants as $participant) {
                $ids[] = $participant->user_id;
            }
        }

        foreach ($minutes as $record) {
            foreach ($record->attendance as $mark) {
                $ids[] = (string) $mark['user_id'];
            }

            if ($record->relationLoaded('actionItems')) {
                foreach ($record->actionItems as $item) {
                    /** @var MeetingActionItem $item */
                    $ids[] = $item->assignee_id;
                }
            }
        }

        return self::loadPeople($ids);
    }

    /**
     * @param  list<string|null>  $ids
     * @return list<array<string, mixed>>
     */
    public static function loadPeople(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids, fn (?string $id): bool => $id !== null && $id !== '')));

        if ($ids === []) {
            return [];
        }

        return MeetingPresenter::people(User::query()
            ->whereIn('id', $ids)
            ->with(['position:id,name', 'division:id,name'])
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_url', 'position_id', 'division_id']));
    }
}
