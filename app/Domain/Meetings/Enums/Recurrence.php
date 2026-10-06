<?php

namespace App\Domain\Meetings\Enums;

/**
 * meetings.recurrence: a series is one row, expanded into occurrences when
 * read (MeetingOccurrences) until `recurrence_until` (inclusive) if set.
 */
enum Recurrence: string
{
    case None = 'none';
    case Weekdays = 'weekdays';
    case Weekly = 'weekly';
    case MonWedFri = 'mon_wed_fri';

    public function label(): string
    {
        return match ($this) {
            self::None => 'Tidak berulang',
            self::Weekdays => 'Setiap hari kerja',
            self::Weekly => 'Setiap minggu',
            self::MonWedFri => 'Senin, Rabu, Jumat',
        };
    }

    /**
     * ISO weekdays (1 = Monday … 7 = Sunday) on which the series meets.
     *
     * @param  int  $firstWeekday  ISO weekday of the first occurrence
     * @return list<int>
     */
    public function weekdays(int $firstWeekday): array
    {
        return match ($this) {
            self::None, self::Weekly => [$firstWeekday],
            self::Weekdays => [1, 2, 3, 4, 5],
            self::MonWedFri => [1, 3, 5],
        };
    }
}
