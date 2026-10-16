<?php

namespace App\Domain\Search\Providers;

use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Support\LikePattern;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Rapat" (F2-3): meetings the viewer may open (Meeting::visibleTo → organizer,
 * minute taker, internal participants; leadership meetings for
 * dashboard.view_company), by title, description, agenda item or place.
 * Canceled meetings are not listed. Ongoing/upcoming meetings and live series
 * first, then newest. Off with the `meetings` feature flag.
 */
final class MeetingSearchProvider implements SearchProvider
{
    public function key(): string
    {
        return 'meetings';
    }

    public function label(): string
    {
        return 'Rapat';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        if (! (bool) config('features.meetings')) {
            return [];
        }

        $pattern = LikePattern::contains($query);

        $meetings = Meeting::query()
            ->visibleTo($viewer)
            ->active()
            ->where(fn (Builder $match) => $match
                ->where('meetings.title', 'ilike', $pattern)
                ->orWhere('meetings.description', 'ilike', $pattern)
                ->orWhere('meetings.location', 'ilike', $pattern)
                ->orWhereRaw('meetings.agenda::text ilike ?', [$pattern]))
            ->orderByRaw("CASE WHEN meetings.ends_at >= now() OR (meetings.recurrence <> 'none' AND (meetings.recurrence_until IS NULL OR meetings.recurrence_until >= current_date)) THEN 0 ELSE 1 END")
            ->orderByDesc('meetings.starts_at')
            ->limit($limit)
            ->get(['meetings.id', 'meetings.title', 'meetings.starts_at', 'meetings.ends_at', 'meetings.platform', 'meetings.recurrence', 'meetings.location']);

        $timezone = config()->string('app.office_timezone');
        $results = [];

        foreach ($meetings as $meeting) {
            $start = $meeting->starts_at->setTimezone($timezone);
            $when = IndonesianDate::short($start).' · '.$start->format('H.i').'–'.$meeting->ends_at->setTimezone($timezone)->format('H.i').' WIB';

            $results[] = new SearchResult(
                id: 'meeting:'.$meeting->id,
                title: $meeting->title,
                icon: 'calendar',
                url: '/rapat/'.$meeting->id,
                subtitle: $meeting->recurrence === Recurrence::None ? $when : $meeting->recurrence->label().' · mulai '.$when,
                meta: $meeting->platform->label(),
            );
        }

        return $results;
    }
}
