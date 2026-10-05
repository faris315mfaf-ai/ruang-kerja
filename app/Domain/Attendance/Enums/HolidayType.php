<?php

namespace App\Domain\Attendance\Enums;

enum HolidayType: string
{
    case National = 'national';
    case CollectiveLeave = 'collective_leave';
    case Company = 'company';

    public function label(): string
    {
        return match ($this) {
            self::National => 'Nasional',
            self::CollectiveLeave => 'Cuti bersama',
            self::Company => 'Perusahaan',
        };
    }

    /**
     * Accepts the stored value or the Indonesian label (CSV import).
     */
    public static function fromInput(string $value): ?self
    {
        $normalized = mb_strtolower(trim($value));

        foreach (self::cases() as $case) {
            if ($normalized === $case->value || $normalized === mb_strtolower($case->label())) {
                return $case;
            }
        }

        return null;
    }
}
