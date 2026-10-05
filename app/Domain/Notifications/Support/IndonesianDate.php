<?php

namespace App\Domain\Notifications\Support;

use Carbon\CarbonInterface;

/**
 * Indonesian date labels for emails, matching resources/js/lib/format.ts
 * ("Sen, 5 Okt 2026" short; "Senin, 5 Okt 2026" long). Independent of the
 * server's ICU/locale data.
 */
final class IndonesianDate
{
    private const array DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    private const array MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public static function long(CarbonInterface $date): string
    {
        return self::DAYS[$date->dayOfWeekIso - 1].', '.$date->day.' '.self::MONTHS[$date->month - 1].' '.$date->year;
    }

    public static function short(CarbonInterface $date): string
    {
        return mb_substr(self::DAYS[$date->dayOfWeekIso - 1], 0, 3).', '.$date->day.' '.self::MONTHS[$date->month - 1].' '.$date->year;
    }
}
