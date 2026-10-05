<?php

namespace App\Domain\Attendance\Support;

/**
 * ISO weekdays (1 = Senin … 7 = Minggu) as compact Indonesian labels:
 * [1..5] → "Sen–Jum", [1, 3, 5] → "Sen, Rab, Jum".
 */
final class Weekdays
{
    public const array SHORT = [1 => 'Sen', 2 => 'Sel', 3 => 'Rab', 4 => 'Kam', 5 => 'Jum', 6 => 'Sab', 7 => 'Min'];

    /**
     * @param  list<int>  $weekdays
     */
    public static function label(array $weekdays): string
    {
        $days = array_values(array_unique(array_filter($weekdays, fn (int $day): bool => $day >= 1 && $day <= 7)));
        sort($days);

        if ($days === []) {
            return '–';
        }

        if (count($days) === 7) {
            return 'Setiap hari';
        }

        $isRange = count($days) >= 3 && count($days) - 1 === $days[count($days) - 1] - $days[0];

        if ($isRange) {
            return self::SHORT[$days[0]].'–'.self::SHORT[$days[count($days) - 1]];
        }

        return implode(', ', array_map(fn (int $day): string => self::SHORT[$day], $days));
    }
}
