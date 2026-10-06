<?php

namespace App\Domain\Reports\Support;

use Carbon\CarbonImmutable;

/**
 * Office dates of daily reports (config('app.office_timezone')). A report is
 * written for "today" and can be changed until 23.59 of that date.
 */
final class ReportDay
{
    public static function today(?CarbonImmutable $now = null): string
    {
        return ($now ?? CarbonImmutable::now())->setTimezone(config()->string('app.office_timezone'))->toDateString();
    }

    /**
     * Last instant the report of $date can still be changed (23.59.59 office time), UTC.
     */
    public static function locksAt(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date, config()->string('app.office_timezone'))->endOfDay()->utc();
    }

    public static function isDate(mixed $value): bool
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1
            && CarbonImmutable::createFromFormat('!Y-m-d', $value) instanceof CarbonImmutable;
    }
}
