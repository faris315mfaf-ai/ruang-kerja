<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\Recurrence;
use App\Models\Meeting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Expands meetings into occurrences. A series keeps the first occurrence's
 * office time of day and duration on every matching office date (weekdays of
 * its Recurrence) from its first date until `recurrence_until` (inclusive).
 * Rules are evaluated in the office timezone, so 09.00 WIB stays 09.00 WIB.
 */
final class MeetingOccurrences
{
    /**
     * Occurrences overlapping [from, to), sorted by start.
     *
     * @param  iterable<Meeting>  $meetings
     * @return Collection<int, Occurrence>
     */
    public function between(iterable $meetings, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        $result = [];

        foreach ($meetings as $meeting) {
            foreach ($this->expand($meeting, $from, $to) as $occurrence) {
                $result[] = $occurrence;
            }
        }

        usort($result, fn (Occurrence $a, Occurrence $b): int => [$a->startsAt->getTimestamp(), $a->meeting->title] <=> [$b->startsAt->getTimestamp(), $b->meeting->title]);

        return collect($result);
    }

    /**
     * @return list<Occurrence>
     */
    public function expand(Meeting $meeting, CarbonImmutable $from, CarbonImmutable $to): array
    {
        if (! $meeting->isRecurring()) {
            $only = $this->first($meeting);

            return $only->overlaps($from, $to) ? [$only] : [];
        }

        $timezone = $this->timezone();
        $firstDate = $meeting->firstDate();
        // A day earlier than the range: an occurrence crossing midnight still overlaps.
        $cursor = max($firstDate, $from->setTimezone($timezone)->subDay()->toDateString());
        $last = $to->setTimezone($timezone)->toDateString();

        if ($meeting->recurrence_until !== null) {
            $last = min($last, $meeting->recurrence_until->toDateString());
        }

        $result = [];

        for ($date = CarbonImmutable::parse($cursor, $timezone); $date->toDateString() <= $last; $date = $date->addDay()) {
            if (! $this->meetsOn($meeting, $date->toDateString())) {
                continue;
            }

            $occurrence = $this->on($meeting, $date->toDateString());

            if ($occurrence->overlaps($from, $to)) {
                $result[] = $occurrence;
            }
        }

        return $result;
    }

    /**
     * The occurrence on an office date, or null when the series does not meet then.
     */
    public function at(Meeting $meeting, string $date): ?Occurrence
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || ! $this->meetsOn($meeting, $date)) {
            return null;
        }

        return $this->on($meeting, $date);
    }

    /**
     * The occurrence a link without a date opens: the requested one when
     * valid, else the one today or the next upcoming, else the last one.
     */
    public function resolve(Meeting $meeting, ?string $date, ?CarbonImmutable $now = null): Occurrence
    {
        if (! $meeting->isRecurring()) {
            return $this->first($meeting);
        }

        if ($date !== null && ($requested = $this->at($meeting, $date)) !== null) {
            return $requested;
        }

        $now ??= CarbonImmutable::now();
        $today = $now->setTimezone($this->timezone())->toDateString();
        $start = max($today, $meeting->firstDate());

        foreach ($this->upcomingDates($meeting, $start, 400) as $candidate) {
            return $this->on($meeting, $candidate);
        }

        // Ended series: walk back from its last date.
        $until = $meeting->recurrence_until?->toDateString() ?? $today;
        $date = CarbonImmutable::parse(min($until, $today), $this->timezone());

        for ($i = 0; $i < 14; $i++, $date = $date->subDay()) {
            if ($date->toDateString() >= $meeting->firstDate() && $this->meetsOn($meeting, $date->toDateString())) {
                return $this->on($meeting, $date->toDateString());
            }
        }

        return $this->first($meeting);
    }

    public function meetsOn(Meeting $meeting, string $date): bool
    {
        $first = $meeting->firstDate();

        if ($date < $first || ($meeting->recurrence_until !== null && $date > $meeting->recurrence_until->toDateString())) {
            return false;
        }

        if ($meeting->recurrence === Recurrence::None) {
            return $date === $first;
        }

        $weekday = CarbonImmutable::parse($date, $this->timezone())->dayOfWeekIso;
        $firstWeekday = CarbonImmutable::parse($first, $this->timezone())->dayOfWeekIso;

        return in_array($weekday, $meeting->recurrence->weekdays($firstWeekday), true);
    }

    /**
     * @return iterable<string>
     */
    private function upcomingDates(Meeting $meeting, string $from, int $limitDays): iterable
    {
        $date = CarbonImmutable::parse($from, $this->timezone());

        for ($i = 0; $i < $limitDays; $i++, $date = $date->addDay()) {
            $value = $date->toDateString();

            if ($meeting->recurrence_until !== null && $value > $meeting->recurrence_until->toDateString()) {
                return;
            }

            if ($this->meetsOn($meeting, $value)) {
                yield $value;
            }
        }
    }

    private function first(Meeting $meeting): Occurrence
    {
        return new Occurrence($meeting, $meeting->firstDate(), $meeting->starts_at, $meeting->ends_at);
    }

    private function on(Meeting $meeting, string $date): Occurrence
    {
        $timezone = $this->timezone();
        $local = $meeting->starts_at->setTimezone($timezone);
        $start = CarbonImmutable::parse($date.' '.$local->format('H:i:s'), $timezone)->utc();

        return new Occurrence($meeting, $date, $start, $start->addMinutes($meeting->durationMinutes()));
    }

    private function timezone(): string
    {
        return config()->string('app.office_timezone');
    }
}
