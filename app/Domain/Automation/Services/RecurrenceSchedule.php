<?php

namespace App\Domain\Automation\Services;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Recurring task schedule (pure, date-only): a line-by-line port of
 * resources/js/features/automation/recurrence.ts (`nextOccurrences`,
 * `matches`, `describePattern`). Both are tested against the same cases
 * (resources/js/features/automation/recurrence-cases.json), so the preview
 * in the form and the 07.00 job always agree.
 *
 * Dates are office calendar days "Y-m-d"; arithmetic runs on UTC midnights
 * (day index = days since 1970-01-01).
 */
final class RecurrenceSchedule
{
    /** Stop scanning after ~3 years: a pattern that never fires is a form error. */
    public const int MAX_SCAN_DAYS = 3 * 366;

    private const array WEEKDAY_NAMES = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];

    public static function isIsoDate(string $value): bool
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $match) !== 1) {
            return false;
        }

        return checkdate((int) $match[2], (int) $match[3], (int) $match[1]);
    }

    /**
     * Next `count` dates (inclusive of `from`) on which the task is created,
     * never before `startsOn` nor after `endsOn`.
     *
     * @param  array<string, mixed>  $pattern
     * @return list<string>
     */
    public static function nextOccurrences(array $pattern, string $startsOn, ?string $endsOn, string $from, int $count = 5): array
    {
        if (! self::isIsoDate($startsOn) || ! self::isIsoDate($from)) {
            return [];
        }

        $start = self::toDay($startsOn);
        $end = $endsOn !== null && self::isIsoDate($endsOn) ? self::toDay($endsOn) : null;
        $result = [];
        $day = max($start, self::toDay($from));

        for ($scanned = 0; $scanned < self::MAX_SCAN_DAYS && count($result) < $count; $scanned++, $day++) {
            if ($end !== null && $day > $end) {
                break;
            }

            if (self::matches($pattern, $day, $start)) {
                $result[] = self::fromDay($day);
            }
        }

        return $result;
    }

    /**
     * Whether a task is due on $date (within the bounds).
     *
     * @param  array<string, mixed>  $pattern
     */
    public static function occursOn(array $pattern, string $startsOn, ?string $endsOn, string $date): bool
    {
        return self::nextOccurrences($pattern, $startsOn, $endsOn, $date, 1) === [$date];
    }

    /**
     * "Setiap Senin dan Kamis", "Setiap bulan tanggal 25", …
     *
     * @param  array<string, mixed>  $pattern
     */
    public static function describe(array $pattern): string
    {
        $weekdays = self::weekdays($pattern);

        return match ($pattern['kind'] ?? null) {
            'daily' => ($pattern['weekdays_only'] ?? false) === true ? 'Setiap hari kerja' : 'Setiap hari',
            'weekly' => $weekdays === [] ? 'Mingguan (pilih hari)' : 'Setiap '.self::weekdayNames($weekdays),
            'monthly' => self::int($pattern, 'day_of_month') >= 31 ? 'Setiap akhir bulan' : 'Setiap bulan tanggal '.self::int($pattern, 'day_of_month'),
            'every_n_weeks' => (self::int($pattern, 'interval') <= 1 ? 'Setiap minggu, ' : 'Setiap '.self::int($pattern, 'interval').' minggu, ')
                .($weekdays === [] ? '(pilih hari)' : 'hari '.self::weekdayNames($weekdays)),
            default => 'Pola tidak dikenal',
        };
    }

    /**
     * @param  array<string, mixed>  $pattern
     */
    private static function matches(array $pattern, int $day, int $start): bool
    {
        $weekday = self::weekdayOf($day);

        switch ($pattern['kind'] ?? null) {
            case 'daily':
                return ($pattern['weekdays_only'] ?? false) !== true || $weekday <= 5;
            case 'weekly':
                return in_array($weekday, self::weekdays($pattern), true);
            case 'monthly':
                $date = self::dateOf($day);
                $last = (int) $date->format('t');
                // Day 31 in a 30-day month falls on the last day.
                $target = min(self::int($pattern, 'day_of_month'), $last);

                return (int) $date->format('j') === $target;
            case 'every_n_weeks':
                if (! in_array($weekday, self::weekdays($pattern), true)) {
                    return false;
                }

                $weeks = intdiv(self::mondayOf($day) - self::mondayOf($start), 7);

                return $weeks % max(1, self::int($pattern, 'interval')) === 0;
            default:
                return false;
        }
    }

    /**
     * @param  array<string, mixed>  $pattern
     * @return list<int>
     */
    private static function weekdays(array $pattern): array
    {
        $values = $pattern['weekdays'] ?? [];

        return is_array($values) ? array_values(array_map(intval(...), array_filter($values, is_numeric(...)))) : [];
    }

    /**
     * @param  array<string, mixed>  $pattern
     */
    private static function int(array $pattern, string $key): int
    {
        $value = $pattern[$key] ?? 0;

        return is_numeric($value) ? (int) $value : 0;
    }

    /**
     * @param  list<int>  $weekdays
     */
    private static function weekdayNames(array $weekdays): string
    {
        sort($weekdays);

        if ($weekdays === [1, 2, 3, 4, 5]) {
            return 'hari kerja';
        }

        $names = array_map(fn (int $value): string => self::WEEKDAY_NAMES[$value] ?? '', $weekdays);

        if (count($names) <= 1) {
            return implode('', $names);
        }

        $last = array_pop($names);

        return implode(', ', $names).' dan '.$last;
    }

    private static function toDay(string $value): int
    {
        return intdiv((int) self::utc($value)->getTimestamp(), 86400);
    }

    private static function fromDay(int $day): string
    {
        return self::dateOf($day)->format('Y-m-d');
    }

    private static function dateOf(int $day): DateTimeImmutable
    {
        return (new DateTimeImmutable('@'.($day * 86400)))->setTimezone(new DateTimeZone('UTC'));
    }

    /** ISO weekday (1 = Monday … 7 = Sunday); 1970-01-01 was a Thursday (ISO 4). */
    private static function weekdayOf(int $day): int
    {
        return ((($day + 3) % 7) + 7) % 7 + 1;
    }

    private static function mondayOf(int $day): int
    {
        return $day - (self::weekdayOf($day) - 1);
    }

    private static function utc(string $value): DateTimeImmutable
    {
        return new DateTimeImmutable($value.' 00:00:00', new DateTimeZone('UTC'));
    }
}
