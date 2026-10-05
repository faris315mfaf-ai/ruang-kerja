<?php

namespace App\Domain\Attendance\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Server-side formatting in the office timezone, matching resources/js/lib/format.ts
 * (docs/DESIGN.md §8): "Sen, 5 Okt 2026" and "08.05".
 */
final class OfficeClock
{
    public static function timezone(): string
    {
        return config()->string('app.office_timezone');
    }

    public static function local(CarbonInterface $value): CarbonImmutable
    {
        return CarbonImmutable::instance($value)->setTimezone(self::timezone());
    }

    public static function time(CarbonInterface $value): string
    {
        return self::local($value)->format('H.i');
    }

    /**
     * For date-only values (work dates) the calendar day is kept as written.
     */
    public static function date(CarbonInterface $value, bool $dateOnly = false): string
    {
        $date = $dateOnly ? CarbonImmutable::parse($value->format('Y-m-d'), self::timezone()) : self::local($value);

        return self::WEEKDAYS[$date->dayOfWeekIso - 1].', '.$date->day.' '.self::MONTHS[$date->month - 1].' '.$date->year;
    }

    private const array WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    private const array MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
}
