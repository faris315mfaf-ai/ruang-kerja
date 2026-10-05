<?php

namespace App\Domain\Analytics\Support;

use App\Domain\Analytics\Data\Period;

/**
 * Builds `CASE WHEN col >= ? AND col < ? THEN 0 … END` so one grouped query
 * returns a metric for several (non-overlapping) periods, e.g. the 8-week trend.
 */
final class PeriodBuckets
{
    /**
     * @param  literal-string  $column
     * @param  non-empty-list<Period>  $periods
     * @param  bool  $dateColumn  true for `date` columns (compared with office dates), false for timestamptz (UTC instants)
     * @return array{0: literal-string, 1: list<string|int>}
     */
    public static function caseExpression(string $column, array $periods, bool $dateColumn): array
    {
        $whens = [];
        $bindings = [];

        foreach ($periods as $index => $period) {
            $whens[] = 'WHEN '.$column.' >= ? AND '.$column.' < ? THEN ?::int';
            $bindings[] = $dateColumn ? $period->startDate() : $period->startUtc()->toIso8601String();
            $bindings[] = $dateColumn ? $period->endDate() : $period->endUtc()->toIso8601String();
            $bindings[] = $index;
        }

        return ['CASE '.implode(' ', $whens).' END', $bindings];
    }

    /**
     * Overall [min start, max end) of the periods, for an index-friendly WHERE.
     *
     * @param  non-empty-list<Period>  $periods
     * @return array{0: string, 1: string}
     */
    public static function bounds(array $periods, bool $dateColumn): array
    {
        $start = $periods[0]->start;
        $end = $periods[0]->end;

        foreach ($periods as $period) {
            $start = $period->start->lt($start) ? $period->start : $start;
            $end = $period->end->gt($end) ? $period->end : $end;
        }

        return $dateColumn
            ? [$start->toDateString(), $end->toDateString()]
            : [$start->utc()->toIso8601String(), $end->utc()->toIso8601String()];
    }
}
