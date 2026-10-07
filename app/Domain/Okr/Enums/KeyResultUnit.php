<?php

namespace App\Domain\Okr\Enums;

/**
 * How a key result value is measured and formatted.
 */
enum KeyResultUnit: string
{
    case Number = 'number';
    case Percent = 'percent';
    case Currency = 'currency';
    case Days = 'days';

    public function label(): string
    {
        return match ($this) {
            self::Number => 'Angka',
            self::Percent => 'Persen (%)',
            self::Currency => 'Rupiah',
            self::Days => 'Hari',
        };
    }
}
