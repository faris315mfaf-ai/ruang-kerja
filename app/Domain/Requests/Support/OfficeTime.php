<?php

namespace App\Domain\Requests\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Office-timezone helpers: dates are office calendar dates (Y-m-d), instants are UTC.
 */
final class OfficeTime
{
    public static function zone(): string
    {
        return config()->string('app.office_timezone', 'Asia/Jakarta');
    }

    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(self::zone())->startOfDay();
    }

    public static function todayString(): string
    {
        return self::today()->toDateString();
    }

    /**
     * Office date + optional "HH:MM" → UTC instant.
     */
    public static function at(string $date, string $time = '00:00'): CarbonImmutable
    {
        return CarbonImmutable::parse("{$date} {$time}", self::zone())->utc();
    }

    /**
     * Start of the office day, in UTC.
     */
    public static function startOfDay(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date, self::zone())->startOfDay()->utc();
    }

    /**
     * End of the office day (23:59:59), in UTC.
     */
    public static function endOfDay(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date, self::zone())->endOfDay()->startOfSecond()->utc();
    }

    public static function local(CarbonInterface $instant): CarbonImmutable
    {
        return CarbonImmutable::instance($instant)->setTimezone(self::zone());
    }

    public static function date(CarbonInterface $instant): string
    {
        return self::local($instant)->toDateString();
    }

    public static function time(CarbonInterface $instant): string
    {
        return self::local($instant)->format('H:i');
    }
}
