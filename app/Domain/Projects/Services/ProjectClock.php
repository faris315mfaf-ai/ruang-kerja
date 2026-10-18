<?php

namespace App\Domain\Projects\Services;

use App\Domain\Tenancy\Support\CurrentCompany;
use Carbon\CarbonImmutable;

/**
 * Project dates are office-calendar dates (office timezone of the current company).
 */
final class ProjectClock
{
    public static function timezone(): string
    {
        return CurrentCompany::timezone();
    }

    /**
     * Start of today in the office timezone.
     */
    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone())->startOfDay();
    }

    /**
     * Office date (Y-m-d) of a stored UTC timestamp.
     */
    public static function date(\DateTimeInterface $moment): string
    {
        return CarbonImmutable::instance($moment)->setTimezone(self::timezone())->format('Y-m-d');
    }

    private const array MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    private const array MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    /**
     * Indonesian month name ("Oktober"; short: "Okt") — independent of the PHP locale.
     */
    public static function monthName(int $month, bool $short = false): string
    {
        return ($short ? self::MONTHS_SHORT : self::MONTHS)[($month - 1) % 12];
    }

    /**
     * Whole days from $from to $to (dates only; negative when $to is earlier).
     */
    public static function daysBetween(\DateTimeInterface $from, \DateTimeInterface $to): int
    {
        return (int) CarbonImmutable::parse($from->format('Y-m-d'), 'UTC')
            ->diffInDays(CarbonImmutable::parse($to->format('Y-m-d'), 'UTC'), false);
    }
}
