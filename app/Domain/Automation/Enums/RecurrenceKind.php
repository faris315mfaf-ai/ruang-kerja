<?php

namespace App\Domain\Automation\Enums;

/**
 * Pattern kind of a recurring task (recurring_tasks.pattern->kind).
 */
enum RecurrenceKind: string
{
    case Daily = 'daily';
    case Weekly = 'weekly';
    case Monthly = 'monthly';
    case EveryNWeeks = 'every_n_weeks';

    public function label(): string
    {
        return match ($this) {
            self::Daily => 'Harian',
            self::Weekly => 'Mingguan',
            self::Monthly => 'Bulanan',
            self::EveryNWeeks => 'Tiap N minggu',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $case): string => $case->value, self::cases());
    }
}
